"""Property Explorer: a one-page property report for any address in the City of Sydney.

Run locally:   streamlit run streamlit_app.py
Hosted:        a container (see Dockerfile), key in the MICROBURBS_API_KEY env var.

The page is built top to bottom:
  1. sidebar   -> pick an address (search, or browse a suburb's recent sales)
  2. load      -> fetch every endpoint the report needs, cached for an hour
  3. render    -> header, value, history, map, risks, schools, transport, suburb
"""

from __future__ import annotations

import os
import re
from datetime import date

import altair as alt
import pandas as pd
import pydeck as pdk
import streamlit as st

from microburbs import Microburbs, Result, property_path, suburb_path

st.set_page_config(page_title="Property Explorer · Microburbs API", page_icon="🏠", layout="wide")

EXAMPLE_ADDRESS = "26 Tudor Street, Surry Hills"
OUTSIDE_AREA = (
    "No address inside the hackathon area matches that. The API covers the City of Sydney "
    "only (29 suburbs, from Barangaroo to Rosebery), so check the spelling or try "
    "'Browse a suburb' to see what's covered."
)

# Endpoints for the property report: name -> path suffix after /v1/properties/{gnaf_id}/
PROPERTY_ENDPOINTS = {
    "basics": "basics/all",
    "profile": "profile",
    "valuation": "valuation/all",
    "value_series": "valuation/value-series",
    "history": "history/all",
    "risks": "risks/all",
    "schools": "schools/all",
    "transport": "transport/nearby",
    "amenities": "amenities/nearby",
}

# Endpoints for the suburb panel: name -> path suffix after /v1/suburbs/{name}/
SUBURB_ENDPOINTS = {
    "summary": "hero/summary",
    "market": "market/all",
    "demographics": "demographics/all",
    "tenure": "demographics/tenure",
}


# --------------------------------------------------------------------------
# API access (cached)
# --------------------------------------------------------------------------


class ApiUnavailable(Exception):
    """Raised inside cached loaders so a failed call is never cached."""


def _setting(name: str) -> str | None:
    """Read a setting from Streamlit secrets first, then the environment."""
    try:
        if name in st.secrets:
            return st.secrets[name]
    except FileNotFoundError:  # no secrets.toml at all: fine for local runs
        pass
    return os.environ.get(name)


@st.cache_resource
def client() -> Microburbs:
    return Microburbs(_setting("MICROBURBS_API_KEY") or "", base_url=_setting("MICROBURBS_API_BASE"))


def _raise_on_error(results: dict[str, Result]) -> dict[str, Result]:
    errors = [f"{name}: {r.message}" for name, r in results.items() if r.status == "error"]
    if errors:
        raise ApiUnavailable("; ".join(errors))
    return results


@st.cache_data(ttl=3600, show_spinner=False)
def load_suburb_names() -> list[str]:
    result = _raise_on_error({"suburbs": client().suburbs()})["suburbs"]
    return [row["suburb"] for row in result.data or []]


@st.cache_data(ttl=3600, show_spinner=False)
def geocode(address: str) -> Result:
    return _raise_on_error({"geocode": client().geocode_address(address)})["geocode"]


@st.cache_data(ttl=3600, show_spinner=False)
def recent_sales(suburb: str) -> Result:
    return _raise_on_error({"sales": client().recent_sales(suburb)})["sales"]


@st.cache_data(ttl=3600, show_spinner=False)
def load_property(gnaf_id: str) -> dict[str, Result]:
    paths = {name: property_path(gnaf_id, ep) for name, ep in PROPERTY_ENDPOINTS.items()}
    return _raise_on_error(client().get_many(paths))


@st.cache_data(ttl=3600, show_spinner=False)
def load_suburb(name: str) -> dict[str, Result]:
    paths = {key: suburb_path(name, ep) for key, ep in SUBURB_ENDPOINTS.items()}
    return _raise_on_error(client().get_many(paths))


# --------------------------------------------------------------------------
# Formatting helpers
# --------------------------------------------------------------------------


def money(x: float | None) -> str:
    """$2.00m / $850k / $735 (weekly rents stay in dollars)."""
    if x is None:
        return "–"
    if x >= 1_000_000:
        return f"${x / 1_000_000:.2f}m"
    if x >= 10_000:
        return f"${x / 1_000:,.0f}k"
    return f"${x:,.0f}"


def pct(x: float | None, signed: bool = False) -> str:
    """Fractions in, percentages out: 0.289 -> '28.9%'."""
    if x is None:
        return "–"
    return f"{x * 100:+.1f}%" if signed else f"{x * 100:.1f}%"


def metres(m: float | None) -> str:
    if m is None:
        return "–"
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{m:.0f} m"


def nice_date(iso: str | None) -> str:
    return date.fromisoformat(iso[:10]).strftime("%-d %b %Y") if iso else "–"


def plain(name: str | None) -> str:
    """Drop the ABS disambiguation suffix for display: 'Glebe (NSW)' -> 'Glebe'.
    Keep the full name for API calls: the suburb endpoints need it exactly."""
    return re.sub(r" \(.*\)", "", name or "")


def is_house(dwelling_type: str | None) -> bool:
    """The market endpoints split by 'house' and 'unit'; map a dwelling type onto one."""
    return (dwelling_type or "").lower() in {"house", "townhouse", "semi", "terrace", "duplex"}


# --------------------------------------------------------------------------
# Sidebar: choosing an address
# --------------------------------------------------------------------------


SEARCH, BROWSE = "Search an address", "Browse a suburb"


def _restore_from_url() -> None:
    """Seed the sidebar widgets from the URL, once per session.

    A new session starts with empty session_state: a first visit, a shared link,
    or a reconnect after the host drops the WebSocket. The URL is what survives,
    so every selection is mirrored into it (see _remember) and read back here.
    """
    if "mode" in st.session_state:
        return
    qp = st.query_params
    st.session_state.mode = BROWSE if "suburb" in qp else SEARCH
    st.session_state.address = qp.get("q", "" if "gnaf" in qp else EXAMPLE_ADDRESS)
    st.session_state.suburb = qp.get("suburb", "Surry Hills")
    st.session_state.street = qp.get("street", "")


def _remember(**params: str) -> None:
    """Mirror the current selection into the URL (?gnaf=...&q=... or &suburb=...)."""
    params = {k: v for k, v in params.items() if v}
    if st.query_params.to_dict() != params:
        st.query_params.from_dict(params)


def _pick_one(label: str, options: dict[str, tuple[str, str]], key: str, help: str | None = None) -> tuple[str, str]:
    """A selectbox over {label: (gnaf_id, address)} that starts on the GNAF in the URL, if listed."""
    if st.session_state.get(key) not in options:
        wanted = st.query_params.get("gnaf")
        st.session_state[key] = next((lbl for lbl, (g, _) in options.items() if g == wanted), next(iter(options)))
    return options[st.sidebar.selectbox(label, list(options), key=key, help=help)]


def pick_property() -> tuple[str, str | None] | None:
    """Return (gnaf_id, display address or None) for the chosen property, or None."""
    _restore_from_url()
    st.sidebar.title("🏠 Property Explorer")
    st.sidebar.caption("Every address in the City of Sydney, from the Microburbs API.")
    mode = st.sidebar.radio("Find a property", [SEARCH, BROWSE], horizontal=True, key="mode")

    if mode == SEARCH:
        query = st.sidebar.text_input("Address", key="address", placeholder="e.g. 26 Tudor Street, Surry Hills").strip()
        if not query:
            # A bare link like ?gnaf=GANSW705970502 opens that property directly.
            gnaf = st.query_params.get("gnaf")
            _remember(gnaf=gnaf)
            return (gnaf, None) if gnaf else None
        picked = _choose_match(geocode(query))
        _remember(q=query, gnaf=picked[0] if picked else None)
        return picked

    suburbs = load_suburb_names()
    if st.session_state.suburb not in suburbs:
        st.session_state.suburb = suburbs[0]
    suburb = st.sidebar.selectbox("Suburb", suburbs, key="suburb")
    street = st.sidebar.text_input("Street and number (optional)", key="street", placeholder="e.g. 12 Crown Street").strip()
    if street:
        # Adding the suburb to the query keeps matches inside it.
        picked = _choose_match(geocode(f"{street} {suburb}"))
        _remember(suburb=suburb, street=street, gnaf=picked[0] if picked else None)
        return picked

    sales = recent_sales(suburb)
    if not sales.ok or not sales.data.get("results"):
        st.sidebar.info(sales.message or f"No recent sales in {plain(suburb)}. Type a street above instead.")
        _remember(suburb=suburb)
        return None
    options = {
        f"{r['address']} · {r['property_type'].lower()} · {money(r['sold_price'])} ({nice_date(r['sold_date'])})":
            (r["gnaf_pid"], f"{r['address']}, {suburb}")
        for r in sales.data["results"]
    }
    picked = _pick_one(f"Recently sold in {plain(suburb)}", options, key="sale", help="The 100 most recent sales.")
    _remember(suburb=suburb, gnaf=picked[0])
    return picked


def _choose_match(result: Result) -> tuple[str, str] | None:
    if result.reason == "outside_hackathon_area":
        st.warning(OUTSIDE_AREA)
        return None
    if not result.ok:
        st.info(result.message or "No matching address. Try the street number and name, e.g. '26 Tudor Street'.")
        return None
    options = {m["name"]: (m["id"], m["name"]) for m in result.data}
    n = len(options)
    return _pick_one(f"{n} match{'es' if n > 1 else ''}", options, key="match")


# --------------------------------------------------------------------------
# Report sections
# --------------------------------------------------------------------------


def section_header(address: str, basics: dict, profile: dict) -> None:
    st.title(plain(address))
    kind = (basics.get("dwelling_type") or "property").capitalize()
    st.caption(f"{kind} · {plain(profile.get('suburb'))} NSW {profile.get('postcode', '')} · {profile.get('lga', '')} council")

    cols = st.columns(5)
    cols[0].metric("Type", kind)
    cols[1].metric("Bedrooms", basics.get("bed_count") or "–")
    cols[2].metric("Bathrooms", basics.get("bath_count") or "–")
    cols[3].metric("Parking", basics.get("parking_count") or "–")
    land = basics.get("land_area_sqm")
    cols[4].metric("Land", f"{land:,.0f} m²" if land else "–")


def section_value(r: dict[str, Result], suburb: dict[str, Result], house: bool) -> None:
    st.subheader("Estimated value")
    avm = (r["valuation"].data or {}).get("avm") if r["valuation"].ok else None
    history = r["history"].data or {}
    last_sale = history.get("sale_history_latest") or {}

    left, right = st.columns([1, 2], gap="large")
    with left:
        if avm:
            st.metric("Microburbs estimate", money(avm["predicted_price"]))
            low, high = money(avm["predicted_price_low"]), money(avm["predicted_price_high"])
            st.markdown(
                # Escape "$": Streamlit Markdown reads "$...$" as a LaTeX formula.
                f"Likely range **\\{low} – \\{high}**  \n"
                f"Confidence {avm['confidence_score']}/100 · as at {nice_date(avm['prediction_date'])}"
            )
            st.progress(avm["confidence_score"] / 100)
        else:
            st.info("No automated valuation for this property yet. The suburb median below is a guide.")
        if last_sale.get("price"):
            delta = None
            if avm:
                change = avm["predicted_price"] / last_sale["price"] - 1
                delta = f"{pct(change, signed=True)} estimate vs this sale"
            st.metric(f"Last sold {nice_date(last_sale['date'])}", money(last_sale["price"]), delta=delta, delta_color="off")
        rent = history.get("rent_history_latest") or {}
        if rent.get("price"):
            st.metric(f"Last advertised rent ({nice_date(rent['date'])})", f"{money(rent['price'])}/wk")

    with right:
        chart = value_chart(r, suburb, house)
        if chart is not None:
            st.altair_chart(chart, width="stretch")


def value_chart(r: dict[str, Result], suburb: dict[str, Result], house: bool) -> alt.Chart | None:
    """Modelled value over time (houses), else the suburb median, with past sales as dots."""
    if r["value_series"].ok:
        line = pd.DataFrame(r["value_series"].data).rename(columns={"month": "date"})
        line_label = "Estimated value of this property"
    else:
        market = suburb["market"].data or {}
        series = (market.get("median_sale_price_series") or {}).get("house" if house else "unit") or []
        if not series:
            return None
        line = pd.DataFrame(series)
        line_label = f"Suburb median {'house' if house else 'unit'} price"
    line["date"] = pd.to_datetime(line["date"])
    line["series"] = line_label

    sales = [s for s in (r["history"].data or {}).get("sale_history") or [] if s.get("price")]
    dots = pd.DataFrame(sales or [{"date": None, "price": None}]).rename(columns={"price": "value"})
    dots["date"] = pd.to_datetime(dots["date"])
    dots["series"] = "Sold"

    colour = alt.Color(
        "series:N",
        scale=alt.Scale(domain=[line_label, "Sold"], range=["#2563eb", "#dc2626"]),
        legend=alt.Legend(title=None, orient="top", labelLimit=0),
    )
    y = alt.Y("value:Q", title=None, axis=alt.Axis(format="$~s"), scale=alt.Scale(zero=False))
    base_line = alt.Chart(line).mark_line(strokeWidth=2.5).encode(
        x=alt.X("date:T", title=None), y=y, color=colour,
        tooltip=[alt.Tooltip("date:T", format="%b %Y"), alt.Tooltip("value:Q", format="$,.0f")],
    )
    sold = alt.Chart(dots.dropna()).mark_circle(size=110, opacity=1).encode(
        x="date:T", y=y, color=colour,
        tooltip=[alt.Tooltip("date:T", title="Sold", format="%-d %b %Y"), alt.Tooltip("value:Q", title="Price", format="$,.0f")],
    )
    return (base_line + sold).properties(height=300)


def section_history(r: dict[str, Result]) -> None:
    history = r["history"].data or {}
    sales = [s for s in history.get("sale_history") or [] if s.get("price")]
    rents = [s for s in history.get("rent_history") or [] if s.get("price")]

    left, right = st.columns(2, gap="large")
    with left:
        st.subheader("Sale history")
        if sales:
            df = pd.DataFrame(sales).sort_values("date")
            df["Change"] = df["price"].pct_change().map(lambda x: pct(x, signed=True) if pd.notna(x) else "")
            df = df.sort_values("date", ascending=False)
            st.dataframe(
                pd.DataFrame({"Date": df["date"].map(nice_date), "Price": df["price"].map(money), "Change": df["Change"]}),
                hide_index=True, width="stretch",
            )
        else:
            st.info("No recorded sales for this property.")
    with right:
        st.subheader("Rent history")
        if rents:
            df = pd.DataFrame(rents).sort_values("date", ascending=False)
            st.dataframe(
                pd.DataFrame({"Date": df["date"].map(nice_date), "Weekly rent": df["price"].map(money)}),
                hide_index=True, width="stretch",
            )
        else:
            st.info("No advertised rents with a price on record.")


# Map colours (RGBA) for each kind of point.
POINT_COLOURS = {
    "This property": [220, 38, 38, 255],
    "Transport": [37, 99, 235, 230],
    "Green Spaces": [22, 163, 74, 170],
    "Supermarket": [234, 88, 12, 170],
    "Restaurant": [147, 51, 234, 120],
}


def section_map(r: dict[str, Result]) -> None:
    transport = r["transport"].data or {}
    amenities = r["amenities"].data or {}
    lat = transport.get("center_lat") or amenities.get("center_lat")
    lng = transport.get("center_lng") or amenities.get("center_lng")
    if lat is None or lng is None:
        return

    points = [{"name": "This property", "kind": "This property", "lat": lat, "lng": lng, "radius": 30}]
    for mode, stop in (transport.get("nearest") or {}).items():
        if stop:
            label = stop.get("name") or stop.get("label") or mode
            points.append({"name": f"{label} ({metres(stop['distance_m'])})", "kind": "Transport",
                           "lat": stop["lat"], "lng": stop["lng"], "radius": 22})
    seen = set()
    for a in amenities.get("results") or []:  # sorted nearest first; some places appear twice
        name = a.get("name") or a["category"]
        if name in seen:
            continue
        seen.add(name)
        points.append({"name": f"{name} ({metres(a['distance_m'])})", "kind": a["category"],
                       "lat": a["lat"], "lng": a["lng"], "radius": 12})

    df = pd.DataFrame(points)
    df["colour"] = df["kind"].map(lambda k: POINT_COLOURS.get(k, [100, 116, 139, 150]))
    df = df.iloc[::-1]  # draw the property last so it sits on top

    st.subheader("On the map")
    st.pydeck_chart(
        pdk.Deck(
            layers=[pdk.Layer("ScatterplotLayer", df, get_position="[lng, lat]", get_fill_color="colour",
                              get_radius="radius",  # metres
                              stroked=True, get_line_color=[255, 255, 255], line_width_min_pixels=1,
                              pickable=True)],
            initial_view_state=pdk.ViewState(latitude=lat, longitude=lng, zoom=15.3),
            tooltip={"text": "{name}"},
            map_style="light",  # free CARTO basemap, no token needed
        ),
        height=380,
    )
    legend = " &nbsp; ".join(
        f"<span style='color:rgb({c[0]},{c[1]},{c[2]})'>●</span> {k}" for k, c in POINT_COLOURS.items()
    )
    counts = amenities.get("counts") or {}
    within = ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in counts.items())
    st.markdown(f"<small>{legend}</small>", unsafe_allow_html=True)
    if within:
        st.caption(f"Within {metres(amenities.get('radius_m'))}: {within}. The map shows the closest {len(amenities.get('results') or [])}.")


RISK_LABELS = {
    "flood": "Flood", "historical_flood": "Historical flood", "bushfire": "Bushfire",
    "heritage": "Heritage", "public_housing": "Public housing", "landslide": "Landslide",
    "erosion": "Erosion", "environment": "Environmental", "hv_power_line": "High-voltage power line",
    "mobile_black_spot": "Mobile black spot",
}


def section_risks(r: dict[str, Result]) -> None:
    st.subheader("Risks and overlays")
    if not r["risks"].ok:
        st.info(r["risks"].message or "No risk data for this property.")
        return
    st.caption("Each overlay is checked within 1 km. A nearby feature is not the same as the property being affected.")
    layers = r["risks"].data
    cols = st.columns(2)
    for i, (key, label) in enumerate(RISK_LABELS.items()):
        rows = layers.get(key) or []
        with cols[i % 2]:
            name_col, badge_col = st.columns([3, 2])
            name_col.markdown(f"**{label}**")
            with badge_col:
                if any(row.get("on_property") for row in rows):
                    st.badge("On this property", color="red")
                elif rows:
                    nearest = min(row.get("nearest_distance_m") or 0 for row in rows)
                    st.badge(f"Nearest {metres(nearest)}", color="orange" if nearest < 200 else "gray")
                else:
                    st.badge("None within 1 km", color="green")


def section_schools_transport(r: dict[str, Result]) -> None:
    left, right = st.columns([3, 2], gap="large")
    with left:
        st.subheader("Nearby schools")
        schools = r["schools"].data or {}
        rows = schools.get("ranking") or schools.get("nearby") or []
        if rows:
            df = pd.DataFrame(rows).sort_values("distance_m").head(10)
            st.dataframe(
                pd.DataFrame({
                    "School": df["name"],
                    "Sector": df["sector"].str.capitalize(),
                    "Level": df["school_level_type"],
                    "Distance": df["distance_m"].map(metres),
                    "NAPLAN": df.get("naplan_label", pd.Series(dtype=str)).fillna("–"),
                }),
                hide_index=True, width="stretch",
            )
        else:
            st.info(r["schools"].message or "No schools found nearby.")
    with right:
        st.subheader("Transport")
        transport = r["transport"].data or {}
        nearest = transport.get("nearest") or {}
        counts = transport.get("counts") or {}
        icons = {"train": "🚆 Train", "bus": "🚌 Bus", "tram": "🚊 Light rail", "ferry": "⛴️ Ferry"}
        cols = st.columns(2)
        for i, (mode, label) in enumerate(icons.items()):
            stop = nearest.get(mode)
            cols[i % 2].metric(
                label,
                metres(stop["distance_m"]) if stop else "–",
                help=(stop.get("name") or stop.get("label")) if stop else None,
            )
        if counts:
            st.caption("Stops within 1 km: " + ", ".join(f"{v} {k}" for k, v in counts.items()))
        train = nearest.get("train")
        if train and train.get("name"):
            st.caption(f"Nearest station: **{train['name']}**")


def section_suburb(name: str, s: dict[str, Result], house: bool) -> None:
    st.subheader(f"About {plain(name)}")
    if s["market"].status == "outside":
        st.warning(OUTSIDE_AREA)
        return

    market = s["market"].data or {}
    price = market.get("median_sale_price") or {}
    rent = market.get("median_rent") or {}
    growth = market.get("price_growth_5y") or {}
    yields = market.get("yield_pct") or {}
    summary = s["summary"].data or {}
    income = (s["demographics"].data or {}).get("income") or []
    tenure = s["tenure"].data or {}

    kind = "house" if house else "unit"
    cols = st.columns(4)
    cols[0].metric(f"Median {kind} price", money(price.get(kind)), delta=f"{pct(growth.get(kind), signed=True)} over 5 years" if growth.get(kind) is not None else None)
    cols[1].metric(f"Median {kind} rent", f"{money(rent.get(kind))}/wk" if rent.get(kind) else "–", delta=f"{pct(yields.get(kind))} gross yield" if yields.get(kind) else None, delta_color="off")
    other = "unit" if house else "house"
    cols[2].metric(f"Median {other} price", money(price.get(other)))
    cols[3].metric(f"Median {other} rent", f"{money(rent.get(other))}/wk" if rent.get(other) else "–")

    cols = st.columns(4)
    cols[0].metric("Population", f"{summary['population']:,}" if summary.get("population") else "–")
    cols[1].metric("Median household income", f"${income[0]['median_income']:,.0f}/yr" if income and income[0].get("median_income") else "–")
    cols[2].metric("Renting", f"{tenure['renting_pct']:.0f}%" if tenure.get("renting_pct") is not None else "–")
    cols[3].metric("Owner-occupied", f"{tenure['owner_occupied_pct']:.0f}%" if tenure.get("owner_occupied_pct") is not None else "–")
    if price.get("as_of"):
        st.caption(f"Market figures as at {nice_date(price['as_of'])}; demographics from the {tenure.get('census_year', 2021)} Census.")


# --------------------------------------------------------------------------
# Page
# --------------------------------------------------------------------------


def main() -> None:
    if not _setting("MICROBURBS_API_KEY"):
        st.error(
            "No API key found. Add `MICROBURBS_API_KEY` to `.streamlit/secrets.toml` "
            "or set it as an environment variable."
        )
        st.stop()

    try:
        picked = pick_property()
        if picked is None:
            st.caption("Search for an address in the City of Sydney, or browse a suburb, using the sidebar.")
            return
        gnaf_id, address = picked
        with st.spinner("Building the report…"):
            r = load_property(gnaf_id)
    except ApiUnavailable as exc:
        st.error(f"The API didn't answer properly, so nothing was cached. Try again in a moment.\n\n{exc}")
        return

    if r["basics"].status == "outside":
        st.warning(OUTSIDE_AREA)
        return

    basics = r["basics"].data or {}
    profile = r["profile"].data or {}
    if address is None:  # opened from a bare ?gnaf= link: build a label from the data
        street = next((s["address"] for s in (r["history"].data or {}).get("sale_history") or [] if s.get("address")), None)
        address = f"{street}, {profile['suburb']}" if street and profile.get("suburb") else f"Property {gnaf_id}"
    house = is_house(basics.get("dwelling_type"))
    suburb_name = profile.get("suburb")
    try:
        s = load_suburb(suburb_name) if suburb_name else {k: Result("empty") for k in SUBURB_ENDPOINTS}
    except ApiUnavailable as exc:
        st.error(f"Couldn't load the suburb figures: {exc}")
        s = {k: Result("empty") for k in SUBURB_ENDPOINTS}

    section_header(address, basics, profile)
    st.divider()
    section_value(r, s, house)
    section_history(r)
    st.divider()
    section_map(r)
    st.divider()
    section_risks(r)
    st.divider()
    section_schools_transport(r)
    st.divider()
    if suburb_name:
        section_suburb(suburb_name, s, house)

    with st.expander("Raw API responses"):
        st.caption(f"GNAF id `{gnaf_id}`. Every section above is built from these responses.")
        st.json({
            **{f"/v1/properties/{{id}}/{PROPERTY_ENDPOINTS[k]}": v.data if v.ok else {"status": v.status, "message": v.message} for k, v in r.items()},
            **{f"/v1/suburbs/{{name}}/{SUBURB_ENDPOINTS[k]}": v.data if v.ok else {"status": v.status, "message": v.message} for k, v in s.items()},
        }, expanded=False)

    st.caption("Data: [Microburbs](https://www.microburbs.com.au) Hackathon API. Estimates are modelled, not a formal valuation.")


main()
