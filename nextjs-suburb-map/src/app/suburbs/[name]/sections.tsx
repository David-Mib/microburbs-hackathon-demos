import Link from "next/link";
import { Columns, Card, Empty, HBars, Kpi, RangeBar, Section, Tag } from "@/components/report/ui";
import { TrendChart } from "@/components/report/TrendChart";
import { type Point, shortName, suburbHref } from "@/lib/api";
import { ServerCalls } from "@/lib/api-store";
import { date, humanise, int, money, pct, signedPct } from "@/lib/format";
import type { Report } from "./data";

/*
 * The report's sections. Each is an async server component: it waits for its
 * own calls (all started together in data.ts), renders, and lists the calls in
 * the request inspector. The page wraps each in <Suspense> so they stream.
 */

type Props = { r: Report; name: string; known: string[] };

const HOUSE = "var(--brand)";
const UNIT = "var(--accent)";

/** Every third month plus the last point: plenty for a chart, a third of the bytes. */
const thin = (pts: Point[] | null | undefined) =>
  (pts ?? []).filter((_, i, a) => (a.length - 1 - i) % 3 === 0);

const toneOf = (n: number | null | undefined) => (n == null ? null : n >= 0 ? "up" : "down");

/* -------------------------------------------------------------- *
 * Market
 * -------------------------------------------------------------- */

export async function MarketSection({ r, name }: Props) {
  const [market, growth, forecast, vacancy, stock, bedrooms, sales] = await Promise.all([
    r.market,
    r.growth,
    r.forecast,
    r.vacancy,
    r.stock,
    r.bedrooms,
    r.sales,
  ]);
  const m = market.data;
  const g = growth.data;
  const f = forecast.data;
  const priceSeries = [
    { name: "Houses", color: HOUSE, points: thin(m?.median_sale_price_series?.house) },
    { name: "Units", color: UNIT, points: thin(m?.median_sale_price_series?.unit) },
  ].filter((s) => s.points.length > 1);
  const rentSeries = [
    { name: "Houses", color: HOUSE, points: thin(m?.median_rent_series?.house) },
    { name: "Units", color: UNIT, points: thin(m?.median_rent_series?.unit) },
  ].filter((s) => s.points.length > 1);

  const periods = ["1yr", "3yr", "5yr", "10yr"] as const;
  const bedRows = (bedrooms.data?.bedrooms ?? []).filter((b) => b.bedrooms >= 1 && b.bedrooms <= 5);
  const fRanges = (["house", "unit"] as const).flatMap((t) => (f?.[t] ? [{ t, ...f[t]! }] : []));
  const fMin = Math.min(0, ...fRanges.map((x) => x.low));
  const fMax = Math.max(0.01, ...fRanges.map((x) => x.high));

  return (
    <Section
      id="market"
      eyebrow="Market"
      title="Prices, rents and how fast homes sell"
      lede={`Median prices and rents for houses and units in ${shortName(name)}, their history, and where the model expects prices to go.`}
    >
      <ServerCalls calls={[market.call, growth.call, forecast.call, vacancy.call, stock.call, bedrooms.call, sales.call]} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Median sale price" note="Monthly, houses and units.">
          {priceSeries.length ? <TrendChart series={priceSeries} format="money" /> : <Empty>No sale-price history for this suburb.</Empty>}
        </Card>
        <Card title="Median weekly rent" note="Monthly, houses and units.">
          {rentSeries.length ? <TrendChart series={rentSeries} format="dollars" /> : <Empty>No rent history for this suburb.</Empty>}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Days on market" value={m?.days_on_market?.unit != null ? `${Math.round(m.days_on_market.unit)} d` : "–"} sub={`Units · houses ${m?.days_on_market?.house != null ? `${Math.round(m.days_on_market.house)} d` : "–"}`} />
        <Kpi label="Vacancy" value={pct(vacancy.data?.unit?.value, 2)} sub={`Units · houses ${pct(vacancy.data?.house?.value, 2)}`} />
        <Kpi label="For sale now" value={int(stock.data?.stock_on_market)} sub={`${int(stock.data?.house)} houses · ${int(stock.data?.unit)} units`} />
        <Kpi label="Gross yield" value={pct(m?.yield_pct?.unit, 1)} sub={`Units · houses ${pct(m?.yield_pct?.house, 1)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Price growth" note="Change in the median sale price over each period.">
          {g ? (
            <table className="w-full text-[14px] tabular-nums">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-[.08em] text-faint">
                  <th className="pb-2 font-medium" />
                  {periods.map((p) => (
                    <th key={p} className="pb-2 text-right font-medium">
                      {p.replace("yr", " yr")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["house", "unit"] as const).map((t) => (
                  <tr key={t} className="border-t border-line">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: t === "house" ? HOUSE : UNIT }} />
                        {t === "house" ? "Houses" : "Units"}
                      </span>
                    </td>
                    {periods.map((p) => {
                      const v = g[t]?.[p];
                      return (
                        <td key={p} className={`py-2.5 text-right font-medium ${v == null ? "text-faint" : v >= 0 ? "text-ok-deep" : "text-bad"}`}>
                          {signedPct(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>{growth.message ?? "No growth figures for this suburb."}</Empty>
          )}
        </Card>
        <Card title="Forecast price growth" note="The model's low, most likely and high case.">
          {fRanges.length ? (
            <div className="grid gap-2">
              {fRanges.map((x) => (
                <div key={x.t} className="grid grid-cols-[64px_1fr] items-center gap-4">
                  <span className="text-[13.5px] text-slate">{x.t === "house" ? "Houses" : "Units"}</span>
                  <RangeBar low={x.low} mid={x.most_likely} high={x.high} min={fMin} max={fMax} format={(n) => signedPct(n)} color={x.t === "house" ? HOUSE : UNIT} />
                </div>
              ))}
            </div>
          ) : (
            <Empty>{forecast.message ?? "No forecast for this suburb."}</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Card title="Price by bedrooms" note="Median sale price.">
          {bedRows.length ? (
            <HBars
              labelWidth={90}
              color={UNIT}
              bars={bedRows.map((b) => ({
                label: `${b.bedrooms} bed`,
                value: b.unit_price ?? b.house_price ?? 0,
                display: money(b.unit_price ?? b.house_price),
                hint: b.unit_price != null ? "unit" : "house",
              }))}
            />
          ) : (
            <Empty>{bedrooms.message ?? "No bedroom breakdown for this suburb."}</Empty>
          )}
        </Card>
        <Card title="Recent sales" note={sales.data ? `${int(sales.data.total)} sales in the last three years; the latest eight.` : undefined}>
          {sales.data?.results.length ? (
            <ul className="-my-1 divide-y divide-line">
              {sales.data.results.map((s) => (
                <li key={s.gnaf_pid + s.sold_date}>
                  <Link
                    href={`/property?gnaf=${encodeURIComponent(s.gnaf_pid)}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 hover:text-brand-deep"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{s.address}</span>
                      <span className="text-[12.5px] text-faint">
                        {s.property_type}
                        {s.bedrooms ? ` · ${s.bedrooms} bed` : ""}
                        {s.bathrooms ? ` · ${s.bathrooms} bath` : ""} · {date(s.sold_date)}
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums">{money(s.sold_price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{sales.message ?? "No recent sales."}</Empty>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- *
 * Safety
 * -------------------------------------------------------------- */

export async function SafetySection({ r, name }: Props) {
  const [summary, breakdown] = await Promise.all([r.crime, r.crimeBreakdown]);
  const s = summary.data;
  const rows = breakdown.data?.breakdown ?? [];
  const tone = (v: string) => (/low/i.test(v) ? "good" : /high/i.test(v) ? "bad" : "warn") as "good" | "bad" | "warn";
  return (
    <Section
      id="safety"
      eyebrow="Safety"
      title="Crime against the national rate"
      lede="Predicted incidents per 100,000 residents a year, from Microburbs' block-level crime model."
    >
      <ServerCalls calls={[summary.call, breakdown.call]} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          {s ? (
            <div>
              <Tag tone={tone(s.verdict)}>{s.verdict}</Tag>
              <div className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{int(s.suburb_median)}</div>
              <p className="mt-2 text-[14px] leading-[1.5] text-slate">
                incidents per 100,000 a year, {Math.abs(s.vs_national_pct)}% {s.vs_national_pct >= 0 ? "above" : "below"} the national median of {int(s.national_median)}.
              </p>
              <Link href={`/crime?suburb=${encodeURIComponent(name)}`} className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand-deep hover:underline">
                Crime block by block →
              </Link>
            </div>
          ) : (
            <Empty>{summary.message ?? "No crime figures."}</Empty>
          )}
        </Card>
        <Card title="What drives it" note="Each offence type; the tick marks the national median.">
          {rows.length ? (
            <HBars
              labelWidth={110}
              color="var(--warn)"
              bars={rows.map((b) => ({ label: b.label, value: b.rate, marker: b.national_median, display: int(b.rate), hint: `${b.diff_pct >= 0 ? "+" : ""}${b.diff_pct}%` }))}
            />
          ) : (
            <Empty>{breakdown.message ?? "No breakdown."}</Empty>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- *
 * Risks
 * -------------------------------------------------------------- */

export async function RisksSection({ r }: Props) {
  const [risks, heritage, slope, counts] = await Promise.all([r.risks, r.heritage, r.slope, r.riskCounts]);
  const flood = risks.data?.flood;
  const bush = risks.data?.bushfire;
  const tiles: { label: string; value: string; sub: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [
    {
      label: "Flood",
      value: flood?.coverage_pct != null ? `${flood.coverage_pct.toFixed(1)}%` : "–",
      sub: flood?.risk_band ? `of the suburb's area · ${humanise(flood.risk_band)} risk` : "of the suburb's area",
      tone: !flood?.coverage_pct ? "good" : flood.coverage_pct > 10 ? "bad" : "warn",
    },
    {
      label: "Bushfire",
      value: bush?.coverage_pct != null ? `${bush.coverage_pct.toFixed(1)}%` : "–",
      sub: "of the suburb's area",
      tone: !bush?.coverage_pct ? "good" : bush.coverage_pct > 10 ? "bad" : "warn",
    },
    {
      label: "Heritage",
      value: heritage.data?.heritage_pct != null ? `${Math.round(heritage.data.heritage_pct)}%` : "–",
      sub: "of properties in a heritage area",
      tone: (heritage.data?.heritage_pct ?? 0) > 50 ? "warn" : "neutral",
    },
    {
      label: "Steep land",
      value: slope.data?.steep_pct != null ? `${slope.data.steep_pct.toFixed(1)}%` : "–",
      sub: slope.data?.median_slope_deg != null ? `of properties · median slope ${slope.data.median_slope_deg.toFixed(1)}°` : "of properties",
      tone: (slope.data?.steep_pct ?? 0) > 15 ? "warn" : "good",
    },
    {
      label: "Contamination",
      value: int(counts.data?.contamination_points_n),
      sub: "recorded contamination sites",
      tone: (counts.data?.contamination_points_n ?? 0) > 0 ? "warn" : "good",
    },
  ];
  const dot = { good: "bg-ok", warn: "bg-warn", bad: "bg-bad", neutral: "bg-faint" };
  return (
    <Section id="risks" eyebrow="Risks" title="Hazards and constraints" lede="Natural hazards, heritage controls and land that can make building or insuring harder.">
      <ServerCalls calls={[risks.call, heritage.call, slope.call, counts.call]} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-card px-5 py-4 shadow-card">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[.08em] text-faint">
              <span className={`h-2 w-2 rounded-full ${dot[t.tone]}`} />
              {t.label}
            </div>
            <div className="mt-1.5 text-[26px] font-semibold tabular-nums tracking-[-0.02em]">{t.value}</div>
            <div className="mt-1 text-[12.5px] leading-[1.4] text-slate">{t.sub}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- *
 * Development
 * -------------------------------------------------------------- */

export async function DevelopmentSection({ r, name }: Props) {
  const [das, density, profile, supply] = await Promise.all([r.das, r.density, r.devProfile, r.supply]);
  const list = das.data ?? [];
  const cats = new Map<string, number>();
  for (const d of list) cats.set(d.category || "Other", (cats.get(d.category || "Other") ?? 0) + 1);
  const catRows = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const latest = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const sup = supply.data?.summary;
  return (
    <Section
      id="development"
      eyebrow="Development"
      title="What's being built"
      lede={`Development applications lodged in ${shortName(name)}, housing density and the mix of new homes.`}
    >
      <ServerCalls calls={[das.call, density.call, profile.call, supply.call]} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Development applications" value={int(list.length)} sub="on record for the suburb" />
        <Kpi label="Density" value={int(density.data?.dwellings_per_km2)} sub={`dwellings per km² · ${density.data?.density_level ?? "–"}`} />
        <Kpi label="Apartments" value={profile.data?.apartment_pct != null ? `${Math.round(profile.data.apartment_pct)}%` : "–"} sub={`of lots · average lot ${int(profile.data?.avg_lot_m2)} m²`} />
        <Kpi label="New dwellings" value={int(sup?.total_new)} sub={sup ? `${Math.round(sup.pct_units)}% units` : "no supply figure"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Applications by type">
          {catRows.length ? (
            <HBars labelWidth={130} color="var(--brand)" bars={catRows.map(([label, n]) => ({ label, value: n, display: int(n) }))} />
          ) : (
            <Empty>{das.message ?? "No development applications."}</Empty>
          )}
        </Card>
        <Card title="Latest applications">
          {latest.length ? (
            <ul className="-my-1 divide-y divide-line">
              {latest.map((d, i) => (
                <li key={i} className="py-3">
                  <div className="flex items-center gap-2 text-[12px] text-faint">
                    <Tag>{d.category || "Other"}</Tag>
                    {date(d.date)}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.5]">{d.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No applications listed.</Empty>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- *
 * Lifestyle
 * -------------------------------------------------------------- */

export async function LifestyleSection({ r, name }: Props) {
  const [livability, narrative, pois, schools] = await Promise.all([r.livability, r.narrative, r.pois, r.schools]);
  const scores = (livability.data?.scores ?? []).filter((s) => s.value != null);
  const bench = livability.data?.benchmark;
  const sentences = Object.entries(narrative.data?.sentences ?? {}).filter(([, v]) => v);
  const cats = (pois.data?.poi_categories ?? []).slice(0, 6);
  const schoolRows = (schools.data ?? []).slice(0, 8);
  return (
    <Section
      id="lifestyle"
      eyebrow="Lifestyle"
      title="What it's like to live here"
      lede={`Livability scores out of 100${bench ? `, against the ${bench.n_suburbs} suburbs of ${bench.region}` : ""}, plus amenities and nearby schools.`}
    >
      <ServerCalls calls={[livability.call, narrative.call, pois.call, schools.call]} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Card title="Livability" note={bench ? "The tick is the regional average." : undefined}>
          {scores.length ? (
            <HBars
              labelWidth={100}
              max={100}
              color="var(--accent)"
              bars={scores.map((s) => ({ label: s.label, value: s.value ?? 0, marker: bench?.scores[s.key], display: s.value, hint: s.level }))}
            />
          ) : (
            <Empty>{livability.message ?? "No livability scores."}</Empty>
          )}
        </Card>
        <Card title={`${shortName(name)} at a glance`}>
          {sentences.length ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {sentences.map(([k, v]) => (
                <div key={k} className="rounded-xl bg-ink/[.03] px-4 py-3">
                  <dt className="text-[12px] font-medium uppercase tracking-[.08em] text-brand-deep">{humanise(k)}</dt>
                  <dd className="mt-1 text-[13.5px] leading-[1.5] text-slate">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Empty>{narrative.message ?? "No description for this suburb."}</Empty>
          )}
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Amenities" note={pois.data ? `${int(pois.data.total_pois)} places of interest in the suburb.` : undefined}>
          {cats.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {cats.map((c) => (
                <li key={c.category} className="rounded-xl border border-line px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-medium">{humanise(c.category)}</span>
                    <span className="text-[18px] font-semibold tabular-nums">{int(c.count)}</span>
                  </div>
                  <div className="mt-1 truncate text-[12.5px] text-faint">
                    {c.top_subtypes.slice(0, 3).map((t) => `${t.label} ${t.count}`).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{pois.message ?? "No amenities listed."}</Empty>
          )}
        </Card>
        <Card title="Schools nearby" note="NAPLAN rank is a national percentile: higher is better.">
          {schoolRows.length ? (
            <ul className="-my-1 divide-y divide-line">
              {schoolRows.map((s) => (
                <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{s.name}</span>
                    <span className="text-[12.5px] text-faint">
                      {s.school_level_type} · {s.school_sector_type}
                      {s.boys != null && s.girls != null ? ` · ${int(s.boys + s.girls)} students` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[15px] font-semibold tabular-nums">
                      {s.naplan_rank != null ? `${Math.round(s.naplan_rank * 100)}` : "–"}
                    </span>
                    <span className="text-[11px] text-faint">NAPLAN</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{schools.message ?? "No schools listed."}</Empty>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- *
 * People
 * -------------------------------------------------------------- */

const AGE_ORDER = (s: string) => parseInt(s, 10);

export async function PeopleSection({ r, name }: Props) {
  const [demo, eth, pop, unemp] = await Promise.all([r.demographics, r.ethnicity, r.population, r.unemployment]);
  const age = (demo.data?.age ?? [])
    .filter((a) => a.gender === "persons")
    .sort((a, b) => AGE_ORDER(a.age_bracket) - AGE_ORDER(b.age_bracket))
    .map((a) => ({ label: a.age_bracket, value: a.proportion }));
  const income = demo.data?.income ?? [];
  const medianIncome = income.find((i) => i.median_income)?.median_income;
  const ancestry = [...(eth.data?.ancestry ?? [])].sort((a, b) => b.proportion - a.proportion).slice(0, 6);
  const birth = [...(eth.data?.birthplace ?? [])].sort((a, b) => b.proportion - a.proportion).slice(0, 6);
  const series = pop.data?.suburb_series ?? [];
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <Section id="people" eyebrow="People" title="Who lives here" lede={`Age, income and heritage of ${shortName(name)}'s residents, from the Census.`}>
      <ServerCalls calls={[demo.call, eth.call, pop.call, unemp.call]} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Population" value={int(pop.data?.current_population)} sub={first && last && first !== last ? `${int(first.population)} in ${first.year}` : "Census 2021"} />
        <Kpi label="Household income" value={medianIncome ? money(medianIncome) : "–"} sub="median, a year" />
        <Kpi
          label="Unemployment"
          value={unemp.data?.unemployment_pct != null ? `${unemp.data.unemployment_pct.toFixed(1)}%` : "–"}
          sub={unemp.data?.national_median_pct != null ? `national ${unemp.data.national_median_pct.toFixed(1)}%` : undefined}
        />
        <Kpi label="Born in Australia" value={pct(birth.find((b) => b.country === "Australia")?.proportion, 0)} sub="of residents" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Age profile" note="Share of residents in each five-year age group; the last column is everyone 55 and over.">
          {age.length ? <Columns data={age} format={(n) => pct(n, 1)} /> : <Empty>No age profile.</Empty>}
        </Card>
        <Card title="Household income" note="Share of households in each yearly income band.">
          {income.length ? (
            <HBars labelWidth={100} color="var(--brand)" bars={income.map((i) => ({ label: i.income_bracket, value: i.proportion, display: pct(i.proportion, 0) }))} />
          ) : (
            <Empty>No income figures.</Empty>
          )}
        </Card>
        <Card title="Ancestry" note="Largest ancestry groups.">
          {ancestry.length ? (
            <HBars labelWidth={170} color="var(--accent)" bars={ancestry.map((a) => ({ label: a.ancestry, value: a.proportion, display: pct(a.proportion, 0) }))} />
          ) : (
            <Empty>No ancestry figures.</Empty>
          )}
        </Card>
        <Card title="Country of birth" note="Top countries of birth.">
          {birth.length ? (
            <HBars labelWidth={140} color="var(--accent)" bars={birth.map((b) => ({ label: b.country, value: b.proportion, display: pct(b.proportion, 1) }))} />
          ) : (
            <Empty>No birthplace figures.</Empty>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- *
 * Nearby
 * -------------------------------------------------------------- */

export async function NearbySection({ r, known }: Props) {
  const [neighbours, similar] = await Promise.all([r.neighbours, r.similar]);
  // Only suburbs in the hackathon area have reports; match on the bare name.
  const byShort = new Map(known.map((k) => [shortName(k).toLowerCase(), k]));
  const resolve = (n: string) => byShort.get(shortName(n).replace(/\s+NSW$/, "").toLowerCase());
  const nb = (neighbours.data?.neighbours ?? []).slice(0, 10);
  const sim = (similar.data ?? []).slice(0, 4);
  return (
    <Section id="nearby" eyebrow="Nearby" title="Neighbours and look-alikes">
      <ServerCalls calls={[neighbours.call, similar.call]} />
      <Card title="Neighbouring suburbs">
        {nb.length ? (
          <ul className="flex flex-wrap gap-2">
            {nb.map((n) => {
              const to = resolve(n.sal);
              const inner = (
                <>
                  {shortName(n.sal)} <span className="text-faint">{n.dist_km.toFixed(1)} km</span>
                </>
              );
              return (
                <li key={n.sal}>
                  {to ? (
                    <Link href={suburbHref(to)} className="inline-flex gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13.5px] hover:border-brand hover:text-brand-deep">
                      {inner}
                    </Link>
                  ) : (
                    <span className="inline-flex gap-1.5 rounded-full border border-dashed border-line px-3 py-1.5 text-[13.5px] text-slate" title="Outside the City of Sydney">
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No neighbours listed.</Empty>
        )}
      </Card>
      {sim.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sim.map((s) => {
            const to = resolve(s.area_name);
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{shortName(s.area_name.replace(/\s+NSW$/, ""))}</h3>
                  {s.keywords && <span className="text-[12px] text-faint">{s.keywords}</span>}
                </div>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-slate">{s.summary}</p>
                {to && <span className="mt-3 inline-block text-[13.5px] font-medium text-brand-deep">Read the report →</span>}
              </>
            );
            return to ? (
              <Link key={s.area_name} href={suburbHref(to)} className="rounded-2xl border border-line bg-card p-5 shadow-card transition hover:border-brand/50">
                {body}
              </Link>
            ) : (
              <div key={s.area_name} className="rounded-2xl border border-line bg-card p-5 shadow-card">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
