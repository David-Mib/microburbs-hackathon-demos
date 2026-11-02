"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { shortName, suburbHref } from "@/lib/api";
import { money } from "@/lib/format";

export type SuburbCard = {
  name: string;
  house: number | null;
  unit: number | null;
  /** 12-month change in asking prices, in percent (e.g. -3.0). */
  houseGrowth: number | null;
  unitGrowth: number | null;
};

const SORTS = {
  name: { label: "A to Z", fn: (a: SuburbCard, b: SuburbCard) => a.name.localeCompare(b.name) },
  house: { label: "House price", fn: (a: SuburbCard, b: SuburbCard) => (b.house ?? -1) - (a.house ?? -1) },
  unit: { label: "Unit price", fn: (a: SuburbCard, b: SuburbCard) => (b.unit ?? -1) - (a.unit ?? -1) },
  growth: {
    label: "House growth",
    fn: (a: SuburbCard, b: SuburbCard) => (b.houseGrowth ?? -999) - (a.houseGrowth ?? -999),
  },
} as const;

/** The suburb cards, with a filter box and a sort. All client-side: the data is already here. */
export function SuburbIndex({ suburbs }: { suburbs: SuburbCard[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("name");
  const shown = useMemo(
    () =>
      suburbs.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())).sort(SORTS[sort].fn),
    [suburbs, q, sort],
  );
  const top = Math.max(...suburbs.map((s) => s.house ?? 0), 1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[240px] flex-1 sm:max-w-[360px]">
          <span className="sr-only">Filter suburbs</span>
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.8" />
            <path d="M10.6 10.6L14 14" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter the 29 suburbs"
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 text-[15px] outline-none placeholder:text-faint focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-card p-1 text-[13.5px]" role="radiogroup" aria-label="Sort">
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={sort === k}
              onClick={() => setSort(k)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition ${sort === k ? "bg-ink text-on-ink" : "text-slate hover:text-ink"}`}
            >
              {SORTS[k].label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[13px] text-faint">Arrows show the change in median asking price over the last 12 months.</p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map((s, i) => (
          <li key={s.name} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
            <Link
              href={suburbHref(s.name)}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] group-hover:text-brand-deep">{shortName(s.name)}</h2>
                  <p className="text-[12.5px] text-faint">City of Sydney, NSW</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-slate transition group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <Figure label="House" value={s.house} growth={s.houseGrowth} />
                <Figure label="Unit" value={s.unit} growth={s.unitGrowth} />
              </dl>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink/[.06]" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
                  style={{ width: `${((s.house ?? 0) / top) * 100}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="mt-8 text-center text-slate">No suburb matches “{q}”.</p>}
    </div>
  );
}

function Figure({ label, value, growth }: { label: string; value: number | null; growth: number | null }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-[.08em] text-faint">{label} median</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="text-[24px] font-semibold tracking-[-0.02em]">{value ? money(value) : "–"}</span>
        {growth != null && (
          <span className={`text-[12.5px] font-medium tabular-nums ${growth >= 0 ? "text-ok-deep" : "text-bad"}`}>
            {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}%
          </span>
        )}
      </dd>
    </div>
  );
}
