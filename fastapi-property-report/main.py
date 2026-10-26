"""Property Report: a one-page property report built on the Microburbs Hackathon API.

FastAPI renders every page on the server with Jinja2 templates; htmx adds the
live address search and the lazily loaded suburb panel. The API key never
leaves the server.

Run locally:   uvicorn main:app --reload
On Vercel:     zero config; Vercel finds `app` in main.py.

Routes
  GET /                              home page with the search panel
  GET /search?address=...            htmx partial: matching addresses
  GET /suburb-sales?suburb=...       htmx partial: recent sales in a suburb
  GET /property/{gnaf_id}            the report (a plain, shareable URL)
  GET /property/{gnaf_id}/suburb     htmx partial: the suburb panel
  GET /suburb-trend?suburb=&kind=    htmx partial: suburb median price chart (stands in for
                                     the value chart on apartments, which have no series)
"""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from microburbs import ApiError, Microburbs, OutsideAreaError

load_dotenv()  # local development: read MICROBURBS_API_KEY from .env (on Vercel, set it in the dashboard)

app = FastAPI(title="Property Report", docs_url=None, redoc_url=None)
templates = Jinja2Templates(directory=Path(__file__).parent / "templates")

DEFAULT_SUBURB = "Surry Hills"

# The property endpoints that make up one report. Each is one API call.
PROPERTY_ENDPOINTS = [
    "basics/all",                       # beds, baths, parking, dwelling type, land area
    "profile",                          # which suburb, postcode, SA2 ...
    "valuation/all",                    # estimated value and its 80% range
    "valuation/value-series",           # estimated value over time (houses only)
    "history/all",                      # sale and rental history
    "risks/all",                        # flood, heritage, bushfire, power lines ...
    "schools/all",                      # nearby schools with NAPLAN ranking
    "transport/nearby",                 # nearest train / bus, plus the property's coordinates
    "amenities/nearby",                 # supermarkets, parks, restaurants within 1 km
    "comparables/recent-sales-nearby",  # recent sales around it, with coordinates
]

# The suburb endpoints for the "About <suburb>" panel.
SUBURB_ENDPOINTS = [
    "market/all",           # median price and rent (with history), growth, yield, days on market
    "hero/summary",         # population and dwellings
    "demographics/income",  # household income brackets and the median
    "demographics/tenure",  # owners vs renters
]

RISK_LABELS = {
    "flood": "Flood",
    "historical_flood": "Historical flood",
    "bushfire": "Bushfire",
    "heritage": "Heritage",
    "landslide": "Landslide",
    "erosion": "Erosion",
    "environment": "Environmental",
    "hv_power_line": "High-voltage power line",
    "public_housing": "Public housing",
    "mobile_black_spot": "Mobile black spot",
}

OUTSIDE_AREA = ("That's outside the hackathon area. This demo covers the 29 suburbs of the City of Sydney "
                "(Surry Hills, Glebe, Pyrmont, Redfern, Zetland …).")


# --------------------------------------------------------------------------
# API access
# --------------------------------------------------------------------------


@lru_cache
def client() -> Microburbs:
    return Microburbs()  # reads MICROBURBS_API_KEY / MICROBURBS_API_BASE from the environment


def call(fn, *args, **kwargs) -> dict:
    """Run one API call and flatten the three possible outcomes into a dict.

    {"data": ...}                       success (data may be None: nothing to show)
    {"data": None, "outside": True}     403, outside the hackathon area
    {"data": None, "error": True}       anything else went wrong
    """
    try:
        res = fn(*args, **kwargs)
        return {"data": res.data, "message": res.message}
    except OutsideAreaError as e:
        return {"data": None, "message": str(e), "outside": True}
    except ApiError as e:
        return {"data": None, "message": str(e), "error": True}


def fetch_all(fn, key: str, endpoints: list[str]) -> dict[str, dict]:
    """Call fn(key, endpoint) for every endpoint, at most 6 at a time (the limit is ~10/s)."""
    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(zip(endpoints, pool.map(lambda ep: call(fn, key, ep), endpoints)))


def suburb_names() -> list[str]:
    return [s["suburb"] for s in call(client().suburbs)["data"] or []]


# --------------------------------------------------------------------------
# Template helpers
# --------------------------------------------------------------------------


def money(x: float | None, short: bool = False) -> str:
    if x is None:
        return "–"
    if short and x >= 1_000_000:
        return f"${x / 1_000_000:.2f}M"
    if short and x >= 1_000:
        return f"${x / 1_000:.0f}k"
    return f"${x:,.0f}"


def pct(x: float | None, signed: bool = False) -> str:
    if x is None:
        return "–"
    return f"{x:+.1%}" if signed else f"{x:.1%}"


def metres(m: float | None) -> str:
    if m is None:
        return "–"
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{m:.0f} m"


def nice_date(iso: str | None, fmt: str = "%-d %b %Y") -> str:
    return date.fromisoformat(iso[:10]).strftime(fmt) if iso else "–"


templates.env.filters.update(money=money, pct=pct, metres=metres, nice_date=nice_date)


def property_kind(basics: dict) -> str:
    """Map a dwelling type onto the suburb market's two buckets: 'house' or 'unit'."""
    return "house" if (basics.get("dwelling_type") or "").lower() in ("house", "townhouse", "semi") else "unit"


def line_chart(series: list[tuple[str, float]], points: list[tuple[str, float]] = (),
               width: int = 640, height: int = 260) -> dict | None:
    """Scale a time series (and optional highlighted points) into SVG coordinates.

    Returns the geometry the `chart` macro in templates/_macros.html draws, so the
    page needs no charting library. Dates are ISO strings; values are dollars.
    """
    all_pts = [(date.fromisoformat(d[:7] + "-01"), v) for d, v in [*series, *points] if v]
    if len(all_pts) < 2:
        return None
    pad_l, pad_r, pad_t, pad_b = 56, 12, 12, 26
    x0, x1 = min(d for d, _ in all_pts).toordinal(), max(d for d, _ in all_pts).toordinal()
    y1 = max(v for _, v in all_pts) * 1.08
    sx = lambda d: pad_l + (date.fromisoformat(d[:7] + "-01").toordinal() - x0) / max(x1 - x0, 1) * (width - pad_l - pad_r)
    sy = lambda v: pad_t + (1 - v / y1) * (height - pad_t - pad_b)

    step = _nice_step(y1 / 4)
    first_year, last_year = date.fromordinal(x0).year, date.fromordinal(x1).year
    year_step = max(1, round((last_year - first_year) / 6))
    return {
        "width": width,
        "height": height,
        "line": " ".join(f"{sx(d):.1f},{sy(v):.1f}" for d, v in series if v),
        "dots": [{"x": sx(d), "y": sy(v), "label": f"{nice_date(d)}: {money(v)}"} for d, v in points if v],
        "yticks": [{"y": sy(v), "label": money(v, short=True)} for v in range(0, int(y1), int(step))],
        "xticks": [{"x": sx(f"{y}-01"), "label": y} for y in range(first_year + 1, last_year + 1, year_step)],
        "plot_left": pad_l,
        "plot_right": width - pad_r,
        "baseline": height - pad_b,
    }


def _nice_step(raw: float) -> float:
    magnitude = 10 ** (len(str(int(raw))) - 1)
    return next(m * magnitude for m in (1, 2, 2.5, 5, 10) if m * magnitude >= raw)


def summarise_risks(layers: dict) -> list[dict]:
    """One row per risk layer, worst first: on the property, nearby (<200 m), or clear."""
    rows = []
    for key, label in RISK_LABELS.items():
        items = layers.get(key) or []
        if not items:
            rows.append({"label": label, "text": "None within 1 km", "level": "ok"})
            continue
        nearest = min(i["nearest_distance_m"] for i in items)
        if any(i.get("on_property") for i in items):
            rows.append({"label": label, "text": "On this property", "level": "high"})
        elif nearest < 200:
            rows.append({"label": label, "text": f"Nearby, {metres(nearest)} away", "level": "medium"})
        else:
            rows.append({"label": label, "text": f"Nearest {metres(nearest)} away", "level": "ok"})
    order = {"high": 0, "medium": 1, "ok": 2}
    return sorted(rows, key=lambda r: order[r["level"]])


def map_points(r: dict) -> dict | None:
    """Everything the Leaflet map draws, as plain JSON."""
    transport = r["transport/nearby"]["data"]
    if not transport:
        return None
    nearest = [
        {"lat": s["lat"], "lng": s["lng"], "name": f"{s.get('name') or s['label']} ({metres(s['distance_m'])})"}
        for s in (transport.get("nearest") or {}).values() if s
    ]
    amenities = [
        {"lat": a["lat"], "lng": a["lng"], "name": " · ".join(filter(None, [a.get("name"), a.get("category")]))}
        for a in ((r["amenities/nearby"]["data"] or {}).get("results") or [])[:60]
    ]
    sales = [
        {"lat": s["latitude"], "lng": s["longitude"],
         "name": f"{s['address'].title()} · sold {money(s['price'])}, {nice_date(s['date_sold'], '%b %Y')}"}
        for s in (r["comparables/recent-sales-nearby"]["data"] or [])[:30]
    ]
    return {"centre": [transport["center_lat"], transport["center_lng"]],
            "transport": nearest, "amenities": amenities, "sales": sales}


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request, "index.html", {
        "suburbs": suburb_names(), "selected_suburb": DEFAULT_SUBURB,
    })


@app.get("/search", response_class=HTMLResponse)
def search(request: Request, address: str = ""):
    """htmx partial: up to 10 address matches for what has been typed so far."""
    address = address.strip()
    if len(address) < 4:
        return templates.TemplateResponse(request, "_search_results.html", {"results": [], "message": None})
    found = call(client().geocode_address, address)
    message = OUTSIDE_AREA if found.get("outside") else found["message"]
    return templates.TemplateResponse(request, "_search_results.html", {
        "results": found["data"] or [], "message": message or "No matching address in the City of Sydney.",
    })


@app.get("/suburb-sales", response_class=HTMLResponse)
def suburb_sales(request: Request, suburb: str = DEFAULT_SUBURB):
    """htmx partial: properties sold in a suburb in the last three years (a handy address picker)."""
    found = call(client().suburb, suburb, "sales/recent", limit=60)
    return templates.TemplateResponse(request, "_suburb_sales.html", {
        "suburb": suburb, "sales": (found["data"] or {}).get("results") or [],
        "message": OUTSIDE_AREA if found.get("outside") else found["message"],
    })


@app.get("/property/{gnaf_id}", response_class=HTMLResponse)
def property_report(request: Request, gnaf_id: str):
    r = fetch_all(client().property, gnaf_id, PROPERTY_ENDPOINTS)

    base = {"suburbs": suburb_names(), "gnaf_id": gnaf_id, "selected_suburb": DEFAULT_SUBURB}
    if r["basics/all"].get("outside"):
        return templates.TemplateResponse(request, "error.html", {**base, "message": OUTSIDE_AREA}, status_code=403)
    if r["basics/all"].get("error"):
        return templates.TemplateResponse(request, "error.html",
                                          {**base, "message": f"The API returned an error: {r['basics/all']['message']}"},
                                          status_code=502)

    basics = r["basics/all"]["data"] or {}
    profile = r["profile"]["data"] or {}
    history = r["history/all"]["data"] or {}
    sales = [s for s in history.get("sale_history") or [] if s.get("price")]
    series = r["valuation/value-series"]["data"] or []
    schools = (r["schools/all"]["data"] or {})
    transport = r["transport/nearby"]["data"] or {}

    # Each sale with the change since the one before it.
    sales_table = sorted(sales, key=lambda s: s["date"], reverse=True)
    for newer, older in zip(sales_table, sales_table[1:]):
        newer["change"] = newer["price"] / older["price"] - 1

    return templates.TemplateResponse(request, "report.html", {
        **base,
        "selected_suburb": profile.get("suburb") or DEFAULT_SUBURB,
        "address": request.query_params.get("address") or _address_from(sales, profile, gnaf_id),
        "basics": basics,
        "kind": property_kind(basics),
        "profile": profile,
        "avm": (r["valuation/all"]["data"] or {}).get("avm"),
        "latest_sale": history.get("sale_history_latest"),
        "latest_rent": history.get("rent_history_latest"),
        "sales": sales_table,
        "chart": line_chart([(p["month"], p["value"]) for p in series], [(s["date"], s["price"]) for s in sales]),
        "risks": summarise_risks(r["risks/all"]["data"] or {}),
        "schools": (schools.get("ranking") or schools.get("nearby") or [])[:10],
        "transport": transport,
        "amenity_counts": (r["amenities/nearby"]["data"] or {}).get("counts") or {},
        "map": map_points(r),
        "raw": r,
    })


@app.get("/property/{gnaf_id}/suburb", response_class=HTMLResponse)
def suburb_panel(request: Request, gnaf_id: str, suburb: str, kind: str = "house", show_chart: bool = True):
    """htmx partial, loaded after the report renders: the suburb at a glance.

    show_chart=0 when the value card above already shows the suburb trend.
    """
    s = fetch_all(client().suburb, suburb, SUBURB_ENDPOINTS)
    if s["market/all"].get("outside"):
        return HTMLResponse(f"<p class='muted'>{OUTSIDE_AREA}</p>")
    market = s["market/all"]["data"] or {}
    income = s["demographics/income"]["data"] or []
    trend = ((market.get("median_sale_price_series") or {}).get(kind)) or []
    return templates.TemplateResponse(request, "_suburb_panel.html", {
        "suburb": suburb,
        "kind": kind,
        "market": market,
        "hero": s["hero/summary"]["data"] or {},
        "median_income": income[0].get("median_income") if income else None,
        "tenure": s["demographics/tenure"]["data"] or {},
        "chart": line_chart([(p["date"], p["value"]) for p in trend], width=1100, height=240) if show_chart else None,
    })


@app.get("/suburb-trend", response_class=HTMLResponse)
def suburb_trend(request: Request, suburb: str, kind: str = "unit"):
    """htmx partial: the suburb's median price history for houses or units."""
    found = call(client().suburb, suburb, "market/median-sale-price-series")
    trend = ((found["data"] or {}).get(kind)) or []
    return templates.TemplateResponse(request, "_suburb_trend.html", {
        "suburb": suburb, "kind": kind,
        "chart": line_chart([(p["date"], p["value"]) for p in trend]),
    })


def _address_from(sales: list[dict], profile: dict, gnaf_id: str) -> str:
    """Best-effort address when the page was opened without ?address=..."""
    street = next((s["address"] for s in sales if s.get("address")), None)
    if street and profile.get("suburb"):
        return f"{street}, {profile['suburb']}"
    return street or gnaf_id
