"use client";

import { useMemo, useState } from "react";
import { AddressSearch } from "@/components/AddressSearch";
import { ChoroplethMap, type Marker, RAMPS } from "@/components/ChoroplethMap";
import { LineChart } from "@/components/LineChart";
import { Failed, NoData, PageShell, Panel, Pending, SourceLine } from "@/components/PageShell";
import { Choices } from "@/components/Pickers";
import { EXAMPLE_PROPERTY, propertyPath, suburbPath } from "@/lib/api";
import { type ApiResult, useApi } from "@/lib/api-store";
import { EXAMPLE_PROPERTIES, useSuburbShapes } from "@/lib/area";
import { DASH, date, metres, money, moneyFull, pctPoints } from "@/lib/format";
import { useQueryParam } from "@/lib/use-query-param";

type Basics = {
  bed_count: number | null;
  bath_count: number | null;
  parking_count: number | null;
  dwelling_type: string | null;
  land_area_sqm: number | null;
};
type Avm = {
  predicted_price: number;
  predicted_price_low: number;
  predicted_price_high: number;
  prediction_date: string;
  confidence_score: number;
};
type Event = { date: string; price: number | null; type: string; address: string };
type History = { sale_history: Event[]; rent_history: Event[] };
type Risk = { name: string; value: string | null; on_property: boolean; nearest_distance_m: number | null };
type Risks = Record<string, Risk[] | null>;
type School = {
  id: number;
  name: string;
  sector: string;
  school_level_type: string;
  distance_m: number;
  naplan_label: string | null;
};
type Profile = { suburb: string; postcode: string; mesh_block: string; sa2: string; lga: string };
type StreetProfile = {
  address: string;
  suburb: string;
  street: string;
  streets_in_suburb: number;
  profile: {
    title: string;
    current_price: number | null;
    n_sales: number;
    annual_2y: number | null;
    annual_4y: number | null;
    annual_8y: number | null;
    confidence: string | null;
    history: { year: number; price: number; suburb_med: number }[];
    houses_on_street: number;
    units_on_street: number;
    median_house_rent_week: number | null;
    sale_turnover: string | null;
    rental_turnover: string | null;
    renters_pct: string | null;
  } | null;
  forecast_rank: { rank: number; total: number; band: string } | null;
};
type NearbySale = {
  address: string;
  gnaf_pid: string;
  price: number | null;
  date_sold: string;
  dist_km: number;
  property_type: string | null;
  bedrooms: number | null;
  latitude: number;
  longitude: number;
};
type Transport = {
  center_lat: number;
  center_lng: number;
  counts: Record<string, number>;
  nearest: Record<string, { label: string; distance_m: number } | null>;
};

const RISK_NAMES: Record<string, string> = {
  flood: "Flood",
  historical_flood: "Past flooding",
  bushfire: "Bushfire",
  landslide: "Landslide",
  erosion: "Erosion",
  heritage: "Heritage",
  environment: "Environmental",
  hv_power_line: "Power lines",
  public_housing: "Public housing",
  mobile_black_spot: "Mobile black spot",
};

export function PropertyProfile() {
  const [gnaf, setGnaf] = useQueryParam("gnaf", EXAMPLE_PROPERTY.gnaf);
  const example = EXAMPLE_PROPERTIES.find((p) => p.gnaf === gnaf);
  // The label the address search showed, for addresses /street/profile has no row for.
  const [picked, setPicked] = useState<{ gnaf: string; label: string } | null>(null);
  const p = (tail: string) => propertyPath(gnaf, tail);

  const basics = useApi<Basics>(p("basics/all"));
  const avm = useApi<Avm>(p("valuation/avm"));
  const profile = useApi<Profile>(p("profile"));
  const street = useApi<StreetProfile>(p("street/profile"));
  const series = useApi<{ month: string; value: number }[]>(p("valuation/value-series"));
  const history = useApi<History>(p("history/all"));
  const risks = useApi<Risks>(p("risks/all"));
  const schools = useApi<School[]>(p("schools/ranking"));
  const transport = useApi<Transport>(p("transport/nearby"));
  const nearby = useApi<NearbySale[]>(p("comparables/recent-sales-nearby"));

  const address =
    street.data?.address ?? example?.address ?? (picked?.gnaf === gnaf ? picked.label.split(",")[0] : undefined);
  const suburb = profile.data?.suburb ?? street.data?.suburb ?? example?.suburb;

  return (
    <PageShell
      slug="property"
      controls={
        <div className="grid gap-3">
          <AddressSearch
            onPick={(id, label) => {
              setPicked({ gnaf: id, label });
              setGnaf(id);
            }}
          />
          <Choices
            label="Example addresses"
            value={gnaf}
            onChange={setGnaf}
            options={EXAMPLE_PROPERTIES.map((x) => ({ value: x.gnaf, label: x.address, hint: x.suburb }))}
            size="sm"
          />
        </div>
      }
    >
      <section className="rounded-2xl border border-line bg-card">
        <div className="grid gap-6 px-5 py-6 sm:px-7 md:grid-cols-[1fr_minmax(260px,380px)]">
          <div>
            <p className="font-mono text-[12px] text-faint">{gnaf}</p>
            <h2 className="mt-1 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[34px]">
              {address ?? (street.loading ? "…" : "Property")}
            </h2>
            <p className="mt-1 text-[16px] text-slate">
              {suburb ? `${suburb} NSW ${profile.data?.postcode ?? ""}` : profile.error ?? ""}
            </p>
            {basics.loading ? (
              <div className="mt-5 h-12 w-72 animate-pulse rounded bg-ink/[.04]" />
            ) : basics.data ? (
              <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
                <Fact label="Type" value={cap(basics.data.dwelling_type)} />
                <Fact label="Bedrooms" value={basics.data.bed_count ?? DASH} />
                <Fact label="Bathrooms" value={basics.data.bath_count ?? DASH} />
                <Fact label="Parking" value={basics.data.parking_count ?? DASH} />
                <Fact label="Land" value={basics.data.land_area_sqm ? `${Math.round(basics.data.land_area_sqm)} m²` : DASH} />
              </dl>
            ) : basics.error ? (
              <div className="mt-5">
                <Failed message={basics.error} />
              </div>
            ) : null}
          </div>

          <div className="rounded-xl bg-brand-wash px-5 py-4">
            {avm.loading ? (
              <Pending height={110} />
            ) : avm.error ? (
              <Failed message={avm.error} />
            ) : avm.data ? (
              <Valuation v={avm.data} />
            ) : (
              <NoData>No valuation for this address. {avm.message}</NoData>
            )}
          </div>
        </div>
        <SourceLine calls={[basics.call, avm.call, profile.call]} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Estimated value over time" calls={[series.call]} className="lg:col-span-3">
          {series.loading ? (
            <Pending height={240} />
          ) : series.error ? (
            <Failed message={series.error} />
          ) : !series.data?.length ? (
            <NoData />
          ) : (
            <LineChart
              series={[
                {
                  name: "Estimated value",
                  color: "#4475e6",
                  points: series.data.map((d) => ({ date: `${d.month}-01`, value: d.value })),
                },
              ]}
              format={money}
            />
          )}
        </Panel>

        <Panel title="Listing and sale history" calls={[history.call]} className="lg:col-span-2">
          {history.loading ? (
            <Pending height={240} />
          ) : history.error ? (
            <Failed message={history.error} />
          ) : (
            <Timeline events={[...(history.data?.sale_history ?? []), ...(history.data?.rent_history ?? [])]} />
          )}
        </Panel>

        <StreetPanel r={street} />

        <NearbyPanel suburb={suburb ?? null} sales={nearby} home={transport.data} address={address} />

        <Panel
          title="Hazards and overlays"
          note="Whether each overlay touches the property, and how far away the nearest one is."
          calls={[risks.call]}
          className="lg:col-span-3"
        >
          {risks.loading ? <Pending height={200} /> : risks.error ? <Failed message={risks.error} /> : <RiskGrid risks={risks.data} />}
        </Panel>

        <Panel title="Getting around" calls={[transport.call]} className="lg:col-span-2">
          {transport.loading ? (
            <Pending height={200} />
          ) : transport.error ? (
            <Failed message={transport.error} />
          ) : (
            <ul className="divide-y divide-line text-[14px]">
              {(["train", "tram", "bus", "ferry"] as const).map((m) => {
                const n = transport.data?.nearest?.[m];
                return (
                  <li key={m} className="flex items-baseline justify-between py-2.5">
                    <span>{cap(m)}</span>
                    <span className={n ? "font-semibold tabular-nums" : "text-faint"}>
                      {n ? `${metres(n.distance_m)} away` : "None within 1 km"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Nearest schools" note="NAPLAN standing within the state." calls={[schools.call]} className="lg:col-span-5">
          {schools.loading ? (
            <Pending height={200} />
          ) : schools.error ? (
            <Failed message={schools.error} />
          ) : !schools.data?.length ? (
            <NoData />
          ) : (
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {[...schools.data]
                .sort((a, b) => a.distance_m - b.distance_m)
                .slice(0, 8)
                .map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 text-[14px]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="text-[13px] text-slate">
                        {cap(s.sector)} {s.school_level_type.toLowerCase()}, {metres(s.distance_m)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold">{s.naplan_label ?? DASH}</span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-slate">{label}</dt>
      <dd className="text-[18px] font-semibold">{value}</dd>
    </div>
  );
}

function Valuation({ v }: { v: Avm }) {
  const span = v.predicted_price_high - v.predicted_price_low || 1;
  const mid = ((v.predicted_price - v.predicted_price_low) / span) * 100;
  return (
    <div>
      <div className="text-[13px] text-slate">Estimated value, {date(v.prediction_date)}</div>
      <div className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.02em] text-brand-deep">
        {moneyFull(v.predicted_price)}
      </div>
      <div className="relative mt-4 h-2 rounded-full bg-brand/25">
        <div className="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded-full bg-brand-deep" style={{ left: `${mid}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-slate">
        <span>{money(v.predicted_price_low)}</span>
        <span>Confidence {v.confidence_score}/100</span>
        <span>{money(v.predicted_price_high)}</span>
      </div>
    </div>
  );
}

function Timeline({ events }: { events: Event[] }) {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  if (!sorted.length) return <NoData>No listings or sales on record.</NoData>;
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {sorted.map((e, i) => {
        const sold = e.type === "Sold";
        return (
          <li key={i} className="relative pb-3 pl-5 last:pb-0">
            <span
              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                sold ? "bg-brand" : "bg-faint"
              }`}
            />
            <div className="flex items-baseline justify-between gap-3 text-[14px]">
              <span>
                <span className={sold ? "font-semibold" : ""}>{e.type}</span>{" "}
                <span className="text-slate">{date(e.date)}</span>
              </span>
              <span className="font-semibold tabular-nums">{e.price ? moneyFull(e.price) : "Price withheld"}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RiskGrid({ risks }: { risks: Risks | null }) {
  if (!risks) return <NoData />;
  return (
    <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {Object.entries(RISK_NAMES).map(([key, name]) => {
        const r = risks[key]?.[0];
        const on = r?.on_property;
        const state = !r
          ? { text: "None within 1 km", tone: "text-[#1b6450]" }
          : on
            ? { text: key === "public_housing" ? (r.value ?? "On the property") : "On the property", tone: "text-warn font-semibold" }
            : r.nearest_distance_m != null
              ? { text: `Nearest ${metres(r.nearest_distance_m)}`, tone: "text-ink" }
              : { text: r.value ?? "Nearby", tone: "text-ink" };
        return (
          <li key={key} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 text-[14px]">
            <span>{name}</span>
            <span className={`text-right tabular-nums ${state.tone}`}>{state.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

const cap = (s: string | null | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : DASH);

function StreetPanel({ r }: { r: ApiResult<StreetProfile> }) {
  const st = r.data?.profile;
  return (
    <Panel
      title={st ? `${st.title}, against ${r.data!.suburb}` : "The street"}
      note="Typical price on this street and in the suburb, year by year, with the street's forecast."
      calls={[r.call]}
      className="lg:col-span-5"
    >
      {r.loading ? (
        <Pending height={260} />
      ) : r.error ? (
        <Failed message={r.error} />
      ) : !st ? (
        <NoData>{r.message ?? "No street profile for this address."}</NoData>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
          <LineChart
            series={[
              { name: st.title, color: "#4475e6", points: st.history.map((h) => ({ date: `${h.year}-06-30`, value: h.price })) },
              {
                name: `${r.data!.suburb} median`,
                color: "#8a97a8",
                points: st.history.map((h) => ({ date: `${h.year}-06-30`, value: h.suburb_med })),
              },
            ]}
            format={money}
          />
          <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-4">
            <Fact label="Typical price now" value={money(st.current_price)} />
            <Fact label="Sales on record" value={st.n_sales} />
            <Fact label="Forecast, a year (next 2 yrs)" value={pctPoints(st.annual_2y)} />
            <Fact label="Forecast, a year (next 8 yrs)" value={pctPoints(st.annual_8y)} />
            <Fact
              label="Forecast rank in suburb"
              value={r.data!.forecast_rank ? `${r.data!.forecast_rank.rank} of ${r.data!.forecast_rank.total}` : DASH}
            />
            <Fact label="Renters on the street" value={st.renters_pct ?? DASH} />
            <div className="col-span-2 text-[13px] leading-[1.5] text-slate">
              Homes sell {st.sale_turnover?.toLowerCase() ?? DASH}; rentals turn over {st.rental_turnover?.toLowerCase() ?? DASH}.
            </div>
          </dl>
        </div>
      )}
    </Panel>
  );
}

function NearbyPanel({
  suburb,
  sales,
  home,
  address,
}: {
  suburb: string | null;
  sales: ApiResult<NearbySale[]>;
  home: Transport | null;
  address?: string;
}) {
  // The suburb name from /profile is a bare name ("Glebe"); resolve it to the
  // exact one ("Glebe (NSW)") with the suburb geocoder before drawing blocks.
  const match = useApi<{ area_name: string }[]>(suburb ? `/v1/geocode/suburb?q=${encodeURIComponent(suburb)}` : null);
  const exact = match.data?.[0]?.area_name ?? null;
  const shapes = useSuburbShapes(exact);
  const list = useMemo(() => (sales.data ?? []).slice(0, 25), [sales.data]);
  const markers = useMemo<Marker[]>(() => {
    const m: Marker[] = list.map((s) => ({
      id: s.gnaf_pid + s.date_sold,
      lat: s.latitude,
      lng: s.longitude,
      label: `${titleCase(s.address)}: ${s.price ? moneyFull(s.price) : "price withheld"}, ${date(s.date_sold)}`,
    }));
    if (home) m.push({ id: "home", lat: home.center_lat, lng: home.center_lng, label: address ?? "This property", tone: "focus" });
    return m;
  }, [list, home, address]);
  const empty = useMemo(() => new Map<string, number>(), []);

  return (
    <Panel
      title="Recent sales nearby"
      note="The latest sales around the address. The orange dot is the property."
      calls={[sales.call, match.call, ...shapes.calls]}
      className="lg:col-span-5"
    >
      {sales.loading ? (
        <Pending height={320} />
      ) : sales.error ? (
        <Failed message={sales.error} />
      ) : !list.length ? (
        <NoData>No recent sales nearby.</NoData>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            {shapes.shapes ? (
              <ChoroplethMap
                shapes={shapes.shapes.features}
                outlines={shapes.boundary && exact ? [{ id: exact, feature: shapes.boundary }] : []}
                values={empty}
                markers={markers}
                format={money}
                ramp={RAMPS.blue}
                legend="Recent sales"
                caption="Recent sales near the property"
                hint="Point at a dot to see the sale."
                hideLegend
                maxHeight={460}
              />
            ) : (
              <Pending height={320} />
            )}
          </div>
          <ul className="max-h-[480px] divide-y divide-line overflow-y-auto pr-1 text-[14px]">
            {list.map((s) => (
              <li key={s.gnaf_pid + s.date_sold} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{titleCase(s.address)}</span>
                  <span className="text-[12.5px] text-slate">
                    {cap(s.property_type)}
                    {s.bedrooms ? `, ${s.bedrooms} bed` : ""}, {date(s.date_sold)}, {metres(s.dist_km * 1000)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{s.price ? money(s.price) : "Withheld"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** "UNIT 315, 82-92 COOPER STREET" → "Unit 315, 82-92 Cooper Street" */
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
