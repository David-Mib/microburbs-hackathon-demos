"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell, SourceLine } from "@/components/PageShell";
import { type HouseUnit, shortName, suburbPath } from "@/lib/api";
import { type ApiResult, type Call, useApis } from "@/lib/api-store";
import { useSuburbList } from "@/lib/area";
import { DASH, money, pct, signedPct } from "@/lib/format";

/** The parts of GET /v1/suburbs/{name}/market/all this table reads. */
type MarketAll = {
  median_sale_price?: HouseUnit<number>;
  median_rent?: HouseUnit<number>;
  yield_pct?: HouseUnit<number>;
  price_growth_5y?: HouseUnit<number>;
  days_on_market?: HouseUnit<number>;
};
type Crime = { vs_national_pct: number; verdict: string };

type Column = {
  key: string;
  label: string;
  /** Which endpoint the column reads, by tail. */
  tail: string;
  get: (data: unknown) => number | null | undefined;
  format: (n: number) => string;
  /** Colour negatives / above-national differently. */
  tone?: (n: number) => string;
};

const ALL = "market/all";
const m = (d: unknown) => d as MarketAll | null;

const COLUMNS: Column[] = [
  { key: "house", label: "House price", tail: ALL, get: (d) => m(d)?.median_sale_price?.house, format: money },
  { key: "unit", label: "Unit price", tail: ALL, get: (d) => m(d)?.median_sale_price?.unit, format: money },
  { key: "rent", label: "House rent", tail: ALL, get: (d) => m(d)?.median_rent?.house, format: (n) => `$${Math.round(n)}/wk` },
  { key: "urent", label: "Unit rent", tail: ALL, get: (d) => m(d)?.median_rent?.unit, format: (n) => `$${Math.round(n)}/wk` },
  { key: "yield", label: "House yield", tail: ALL, get: (d) => m(d)?.yield_pct?.house, format: (n) => pct(n) },
  { key: "uyield", label: "Unit yield", tail: ALL, get: (d) => m(d)?.yield_pct?.unit, format: (n) => pct(n) },
  {
    key: "g5",
    label: "House 5-yr growth",
    tail: ALL,
    get: (d) => m(d)?.price_growth_5y?.house,
    format: (n) => signedPct(n, 0),
    tone: (n) => (n < 0 ? "text-warn" : ""),
  },
  {
    key: "ug5",
    label: "Unit 5-yr growth",
    tail: ALL,
    get: (d) => m(d)?.price_growth_5y?.unit,
    format: (n) => signedPct(n, 0),
    tone: (n) => (n < 0 ? "text-warn" : ""),
  },
  {
    key: "dom",
    label: "Days on market",
    tail: ALL,
    get: (d) => m(d)?.days_on_market?.unit ?? m(d)?.days_on_market?.house,
    format: (n) => `${Math.round(n)}`,
  },
  {
    key: "crime",
    label: "Crime vs national",
    tail: "crime/summary",
    get: (d) => (d as Crime)?.vs_national_pct,
    format: (n) => `${n > 0 ? "+" : ""}${n}%`,
    tone: (n) => (n > 0 ? "text-warn" : "text-ok-deep"),
  },
];

const TAILS = [...new Set(COLUMNS.map((c) => c.tail))];

export function SuburbCompare() {
  const list = useSuburbList();
  const suburbs = list.names;
  const paths = suburbs.flatMap((name) => TAILS.map((t) => suburbPath(name, t)));
  const results = useApis<unknown>(paths);
  const byPath = new Map(paths.map((p, i) => [p, results[i]] as [string, ApiResult<unknown>]));
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "house", desc: true });

  const rows = suburbs.map((name) => {
    const values: Record<string, number | null> = {};
    for (const c of COLUMNS) {
      const r = byPath.get(suburbPath(name, c.tail));
      const v = r?.data != null ? c.get(r.data) : null;
      values[c.key] = typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    const loading = TAILS.some((t) => byPath.get(suburbPath(name, t))?.loading);
    return { name, values, loading };
  });

  const col = COLUMNS.find((c) => c.key === sort.key)!;
  rows.sort((a, b) => {
    const x = a.values[col.key];
    const y = b.values[col.key];
    if (x == null) return 1;
    if (y == null) return -1;
    return sort.desc ? y - x : x - y;
  });

  const max = Object.fromEntries(
    COLUMNS.map((c) => [c.key, Math.max(...rows.map((r) => Math.abs(r.values[c.key] ?? 0)), 1e-9)]),
  );
  const calls = results.map((r) => r.call).filter((c): c is Call => !!c);
  const pending = results.filter((r) => r.loading).length;

  return (
    <PageShell slug="compare">
      <p className="mb-3 text-[14px] text-slate" aria-live="polite">
        {list.loading
          ? "Fetching the suburb list…"
          : pending
            ? `${results.length - pending} of ${results.length} calls back. The first visit is the slowest: the app's server keeps answers for an hour.`
            : `${suburbs.length} suburbs, ${TAILS.length} calls each. Click a column to sort; click a suburb for its market dashboard. Units are the bigger market here, so days on market is for units where there are any. On a narrow screen the table scrolls sideways.`}
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="sticky left-0 z-10 min-w-[150px] bg-card px-5 py-3 font-medium">Suburb</th>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                      className="px-1.5 py-1.5 text-right font-medium"
                    >
                      <button
                        type="button"
                        onClick={() => setSort({ key: c.key, desc: active ? !sort.desc : true })}
                        className={`whitespace-nowrap rounded px-1.5 py-1.5 hover:bg-ink/5 ${active ? "text-brand-deep" : "text-slate"}`}
                      >
                        {c.label}
                        <span className="ml-1 inline-block w-2 text-[10px]">{active ? (sort.desc ? "▼" : "▲") : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ name, values, loading }) => (
                <tr key={name} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-5 py-2.5 text-left font-normal">
                    <Link
                      href={`/market?suburb=${encodeURIComponent(name)}`}
                      className="block whitespace-nowrap font-semibold hover:text-brand-deep"
                    >
                      {shortName(name)}
                    </Link>
                    {name !== shortName(name) && (
                      <span className="block whitespace-nowrap font-mono text-[11px] text-faint">{name}</span>
                    )}
                  </th>
                  {COLUMNS.map((c) => {
                    const v = values[c.key];
                    return (
                      <td key={c.key} className="px-2.5 py-2.5 text-right tabular-nums">
                        {loading && v == null ? (
                          <span className="inline-block h-3 w-14 animate-pulse rounded bg-ink/[.06]" />
                        ) : v == null ? (
                          <span className="text-faint">{DASH}</span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-medium ${c.tone?.(v) ?? ""}`}>{c.format(v)}</span>
                            <span
                              className={`h-[3px] rounded-full ${sort.key === c.key ? "bg-brand" : "bg-ink/15"}`}
                              style={{ width: `${Math.max(4, (Math.abs(v) / max[c.key]) * 64)}px` }}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceLine calls={[list.call, ...calls.slice(0, TAILS.length)]} />
      </div>
      <p className="mt-3 text-[13px] text-slate">
        The request inspector lists all {results.length + 1} calls. The line under the table shows the list call and
        the first suburb&apos;s.
      </p>
    </PageShell>
  );
}
