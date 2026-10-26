"use client";

import Link from "next/link";
import { LineChart, type Series } from "@/components/LineChart";
import { Failed, NoData, PageShell, Panel, Pending } from "@/components/PageShell";
import { SuburbSelect } from "@/components/Pickers";
import { EXAMPLE_SUBURB, type HouseUnit, type Point, suburbPath } from "@/lib/api";
import { type ApiResult, useApi } from "@/lib/api-store";
import { DASH, date, int, money, moneyFull, pct, signedPct } from "@/lib/format";
import { useQueryParam } from "@/lib/use-query-param";

const HOUSE = "#4475e6";
const UNIT = "#d4583b";

type SeriesBody = HouseUnit<Point[]>;
type Growth = HouseUnit<{ "1yr"?: number; "3yr"?: number; "5yr"?: number; "10yr"?: number }>;
type Forecast = HouseUnit<{ low: number; most_likely: number; high: number; confidence: number }>;
type Dom = HouseUnit<number>;
type RecentSales = {
  total: number;
  results: {
    gnaf_pid: string;
    address: string;
    property_type: string | null;
    bedrooms: number | null;
    sold_price: number | null;
    sold_date: string;
  }[];
};

export function MarketDashboard() {
  const [suburb, setSuburb] = useQueryParam("suburb", EXAMPLE_SUBURB);
  const p = (tail: string) => suburbPath(suburb, tail);

  const price = useApi<SeriesBody>(p("market/median-sale-price-series"));
  const rent = useApi<SeriesBody>(p("market/median-rent-series"));
  const yld = useApi<SeriesBody>(p("market/yield-pct-series"));
  const vacancy = useApi<SeriesBody>(p("market/vacancy-rate-series"));
  const growth = useApi<Growth>(p("market/price-growth"));
  const forecast = useApi<Forecast>(p("forecast/sale"));
  const dom = useApi<Dom>(p("market/days-on-market"));
  const sales = useApi<RecentSales>(p("sales/recent"));

  const last = (r: ApiResult<SeriesBody>, k: "house" | "unit") => r.data?.[k]?.at(-1)?.value;

  return (
    <PageShell slug="market" controls={<SuburbSelect value={suburb} onChange={setSuburb} />}>
      <div className="mb-4 flex items-center gap-4 text-[13px] text-slate">
        <Key colour={HOUSE} label="Houses" />
        <Key colour={UNIT} label="Units" />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Kpi label="Median price" loading={price.loading} house={money(last(price, "house"))} unit={money(last(price, "unit"))} />
        <Kpi label="Weekly rent" loading={rent.loading} house={money(last(rent, "house"))} unit={money(last(rent, "unit"))} />
        <Kpi label="Gross yield" loading={yld.loading} house={pct(last(yld, "house"))} unit={pct(last(yld, "unit"))} />
        <Kpi
          label="Days on market"
          loading={dom.loading}
          house={dom.data?.house != null ? `${Math.round(dom.data.house)} days` : DASH}
          unit={dom.data?.unit != null ? `${Math.round(dom.data.unit)} days` : DASH}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SeriesPanel title="Median sale price" r={price} format={money} />
        <SeriesPanel title="Median weekly rent" r={rent} format={(n) => `$${Math.round(n)}`} />
        <SeriesPanel title="Gross rental yield" r={yld} format={(n) => pct(n)} />
        <SeriesPanel title="Rental vacancy rate" r={vacancy} format={(n) => pct(n, 2)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Past growth" note="Change in median sale price over each period." calls={[growth.call]}>
          {growth.loading ? (
            <Pending height={140} />
          ) : growth.error ? (
            <Failed message={growth.error} />
          ) : (
            <table className="w-full text-[14px] tabular-nums">
              <thead>
                <tr className="text-left text-[12px] text-slate">
                  <th className="pb-2 font-normal" />
                  {(["1yr", "3yr", "5yr", "10yr"] as const).map((k) => (
                    <th key={k} className="pb-2 text-right font-normal">
                      {k.replace("yr", " yr")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["house", "unit"] as const).map((t) => (
                  <tr key={t} className="border-t border-line">
                    <td className="py-2.5">
                      <Key colour={t === "house" ? HOUSE : UNIT} label={t === "house" ? "Houses" : "Units"} />
                    </td>
                    {(["1yr", "3yr", "5yr", "10yr"] as const).map((k) => {
                      const v = growth.data?.[t]?.[k];
                      return (
                        <td key={k} className={`py-2.5 text-right font-semibold ${v != null && v < 0 ? "text-warn" : ""}`}>
                          {signedPct(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Forecast"
          note="Expected sale-price growth: low, most likely and high. Confidence runs from 1 to 5."
          calls={[forecast.call]}
        >
          {forecast.loading ? (
            <Pending height={140} />
          ) : forecast.error ? (
            <Failed message={forecast.error} />
          ) : !forecast.data ? (
            <NoData />
          ) : (
            <ForecastBars data={forecast.data} />
          )}
        </Panel>
      </div>

      <Panel
        title="Latest sales"
        note={sales.data ? `${int(sales.data.total)} sales in the last three years. The newest ones:` : undefined}
        calls={[sales.call]}
        className="mt-4"
      >
        {sales.loading ? (
          <Pending height={200} />
        ) : sales.error ? (
          <Failed message={sales.error} />
        ) : !sales.data?.results.length ? (
          <NoData />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-slate">
                  <th className="pb-2 font-normal">Address</th>
                  <th className="pb-2 font-normal">Type</th>
                  <th className="pb-2 text-right font-normal">Beds</th>
                  <th className="pb-2 text-right font-normal">Sold</th>
                  <th className="pb-2 text-right font-normal">Price</th>
                </tr>
              </thead>
              <tbody>
                {sales.data.results.slice(0, 12).map((r) => (
                  <tr key={r.gnaf_pid + r.sold_date} className="border-t border-line">
                    <td className="py-2">
                      <Link href={`/property?gnaf=${r.gnaf_pid}`} className="hover:text-brand-deep hover:underline">
                        {r.address}
                      </Link>
                    </td>
                    <td className="py-2 text-slate">{r.property_type ?? DASH}</td>
                    <td className="py-2 text-right tabular-nums">{r.bedrooms ?? DASH}</td>
                    <td className="py-2 text-right tabular-nums text-slate">{date(r.sold_date)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{moneyFull(r.sold_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-3.5" style={{ background: colour }} />
      {label}
    </span>
  );
}

function Kpi({ label, house, unit, loading }: { label: string; house: string; unit: string; loading: boolean }) {
  return (
    <div className="bg-card px-4 py-4 sm:px-5">
      <div className="text-[13px] text-slate">{label}</div>
      {loading ? (
        <div className="mt-2 h-12 animate-pulse rounded bg-ink/[.04]" />
      ) : (
        <div className="mt-1">
          <div className="text-[24px] font-semibold leading-tight tracking-[-0.02em] tabular-nums" style={{ color: HOUSE }}>
            {house}
          </div>
          <div className="text-[15px] font-medium tabular-nums" style={{ color: UNIT }}>
            {unit}
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesPanel({
  title,
  r,
  format,
}: {
  title: string;
  r: ApiResult<SeriesBody>;
  format: (n: number) => string;
}) {
  const series: Series[] = [
    { name: "Houses", color: HOUSE, points: r.data?.house ?? [] },
    { name: "Units", color: UNIT, points: r.data?.unit ?? [] },
  ];
  return (
    <Panel title={title} calls={[r.call]}>
      {r.loading ? (
        <Pending height={250} />
      ) : r.error ? (
        <Failed message={r.error} />
      ) : !r.data ? (
        <NoData />
      ) : (
        <LineChart series={series} format={format} />
      )}
    </Panel>
  );
}

function ForecastBars({ data }: { data: Forecast }) {
  const rows = (["house", "unit"] as const).flatMap((t) => (data[t] ? [{ t, f: data[t]! }] : []));
  const lo = Math.min(0, ...rows.map((r) => r.f.low));
  const hi = Math.max(0.01, ...rows.map((r) => r.f.high));
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="grid gap-5 pt-1">
      {rows.map(({ t, f }) => (
        <div key={t}>
          <div className="flex items-baseline justify-between text-[14px]">
            <Key colour={t === "house" ? HOUSE : UNIT} label={t === "house" ? "Houses" : "Units"} />
            <span>
              <span className="font-semibold tabular-nums">{signedPct(f.most_likely)}</span>{" "}
              <span className="text-slate">most likely, confidence {f.confidence} of 5</span>
            </span>
          </div>
          <div className="relative mt-2 h-3 rounded-full bg-ink/[.05]">
            <div
              className="absolute inset-y-0 rounded-full opacity-30"
              style={{ left: x(f.low), right: `calc(100% - ${x(f.high)})`, background: t === "house" ? HOUSE : UNIT }}
            />
            <div className="absolute -inset-y-1 w-0.5 bg-ink/40" style={{ left: x(0) }} />
            <div
              className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ left: x(f.most_likely), background: t === "house" ? HOUSE : UNIT }}
            />
          </div>
          <div className="relative mt-1 h-4 font-mono text-[11px] text-faint">
            <span className="absolute" style={{ left: x(f.low) }}>
              {signedPct(f.low)}
            </span>
            <span className="absolute -translate-x-full" style={{ left: x(f.high) }}>
              {signedPct(f.high)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
