"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChoroplethMap, RAMPS, rampFor } from "@/components/ChoroplethMap";
import { Failed, NoData, PageShell, Panel, Pending } from "@/components/PageShell";
import { SuburbSelect } from "@/components/Pickers";
import { EXAMPLE_SUBURB, shortName, suburbHref, suburbPath } from "@/lib/api";
import { useApi, useApis } from "@/lib/api-store";
import { useSuburbList, useSuburbShapes } from "@/lib/area";
import { int } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { useQueryParam } from "@/lib/use-query-param";

type Summary = {
  unit: string;
  suburb_median: number;
  national_median: number;
  vs_national_pct: number;
  verdict: string;
};
type Breakdown = {
  unit: string;
  breakdown: { type: string; label: string; rate: number; national_median: number; diff_pct: number; verdict: string }[];
};
type ByBlock = { unit: string; definition: string; mesh_blocks: Record<string, number> };
type Livability = {
  scores: { key: string; label: string; value: number; level: string }[];
  benchmark: { region: string; n_suburbs: number; scores: Record<string, number> };
};

/**
 * Crime for one suburb: the verdict against the national rate, where it ranks
 * in the City of Sydney, which offences drive it, and which blocks carry it.
 * Each panel takes the suburb and fetches what it needs, so adding a view is
 * one more component. `?suburb=` picks the suburb, so other pages can link here.
 */
export function CrimeDashboard() {
  const [suburb, setSuburb] = useQueryParam("suburb", EXAMPLE_SUBURB);
  return (
    <PageShell
      slug="crime"
      controls={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <SuburbSelect value={suburb} onChange={setSuburb} />
          <Link href={suburbHref(suburb)} className="text-[14px] text-brand-deep hover:underline">
            Full suburb report →
          </Link>
        </div>
      }
    >
      <div key={suburb} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-2">
          <HeadlinePanel suburb={suburb} />
        </div>
        <SafetyPanel suburb={suburb} />
        <div className="md:col-span-2 xl:col-span-3">
          <BlockMapPanel suburb={suburb} />
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <BreakdownPanel suburb={suburb} />
        </div>
        <CityRankPanel suburb={suburb} onPick={setSuburb} />
      </div>
    </PageShell>
  );
}

const verdictTone = (v: string) =>
  /high/i.test(v) ? "text-bad" : /low/i.test(v) ? "text-ok-deep" : "text-warn";

function HeadlinePanel({ suburb }: { suburb: string }) {
  const { data, call, loading, error } = useApi<Summary>(suburbPath(suburb, "crime/summary"));
  const label = shortName(suburb);
  return (
    <Panel title="Against the national rate" calls={[call]} className="h-full">
      {loading ? (
        <Pending height={170} />
      ) : error ? (
        <Failed message={error} />
      ) : !data ? (
        <NoData />
      ) : (
        <div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className={`text-[44px] font-semibold leading-none tracking-[-0.03em] ${verdictTone(data.verdict)}`}>
              {data.verdict}
            </p>
            <p className="pb-1 text-[15px] text-slate">
              <span className="text-[22px] font-semibold tabular-nums text-ink">
                {(data.suburb_median / data.national_median).toFixed(1)}×
              </span>{" "}
              the national median
            </p>
          </div>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.55] text-slate">
            {label} runs at <strong className="text-ink">{int(data.suburb_median)}</strong> predicted incidents per
            100,000 residents a year,{" "}
            {data.vs_national_pct === 0
              ? "level with"
              : `${Math.abs(data.vs_national_pct)}% ${data.vs_national_pct > 0 ? "above" : "below"}`}{" "}
            the national median of {int(data.national_median)}.
          </p>
          <RateScale suburb={data.suburb_median} national={data.national_median} />
        </div>
      )}
    </Panel>
  );
}

/** Two markers on one axis: this suburb and the national median. */
function RateScale({ suburb, national }: { suburb: number; national: number }) {
  const theme = useTheme();
  const heat = rampFor(RAMPS.heat, theme);
  const green = rampFor(RAMPS.green, theme);
  const max = Math.max(suburb, national) * 1.15;
  const at = (v: number) => `${(v / max) * 100}%`;
  const above = suburb > national;
  return (
    <div className="mt-6 pb-7">
      <div className="relative h-2.5 rounded-full bg-ink/[.07]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: at(suburb),
            background: above ? `linear-gradient(90deg, ${heat[1]}, ${heat[3]})` : green[3],
          }}
        />
        <div className="absolute -top-1.5 h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-ink" style={{ left: at(national) }} />
        <div
          className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-[12px] text-slate"
          style={{ left: at(national) }}
        >
          National {int(national)}
        </div>
      </div>
    </div>
  );
}

function SafetyPanel({ suburb }: { suburb: string }) {
  const { data, call, loading, error } = useApi<Livability>(suburbPath(suburb, "lifestyle/livability"));
  const safety = data?.scores.find((s) => s.key === "safety");
  const region = data?.benchmark.scores.safety;
  return (
    <Panel title="Safety score" note="0 to 100; higher means less predicted crime." calls={[call]} className="h-full">
      {loading ? (
        <Pending height={150} />
      ) : error ? (
        <Failed message={error} />
      ) : !safety ? (
        <NoData />
      ) : (
        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <Dial value={safety.value} />
          <div className="text-[15px] leading-[1.5]">
            <p className="font-semibold">{safety.level}</p>
            {region != null && (
              <p className="text-[13.5px] text-slate">
                The {data!.benchmark.n_suburbs} suburbs of {data!.benchmark.region} average {Math.round(region)}.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Dial({ value }: { value: number }) {
  const theme = useTheme();
  const heat = rampFor(RAMPS.heat, theme);
  const green = rampFor(RAMPS.green, theme);
  const r = 58;
  const c = Math.PI * r;
  const colour = value >= 60 ? green[3] : value >= 40 ? heat[2] : heat[3];
  return (
    <svg width="160" height="92" viewBox="0 0 160 92" role="img" aria-label={`Safety ${value} out of 100`}>
      <path d={`M22,82 A${r},${r} 0 0 1 138,82`} fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
      <path
        d={`M22,82 A${r},${r} 0 0 1 138,82`}
        fill="none"
        stroke={colour}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
      />
      <text x="80" y="78" textAnchor="middle" fill="var(--ink)" className="text-[34px] font-semibold">
        {value}
      </text>
    </svg>
  );
}

/** Each offence type: the suburb's rate against the national median, as paired bars. */
function BreakdownPanel({ suburb }: { suburb: string }) {
  const theme = useTheme();
  const heat = rampFor(RAMPS.heat, theme);
  const green = rampFor(RAMPS.green, theme);
  const { data, call, loading, error } = useApi<Breakdown>(suburbPath(suburb, "crime/breakdown"));
  const rows = data?.breakdown ?? [];
  const max = Math.max(1, ...rows.flatMap((r) => [r.rate, r.national_median]));
  return (
    <Panel
      title="What drives it"
      note="Each offence type, predicted incidents per 100,000 residents a year."
      calls={[call]}
      action={
        <div className="hidden shrink-0 items-center gap-4 pt-1 text-[12px] text-slate sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ background: heat[3] }} />
            {shortName(suburb)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-slate/50" />
            National median
          </span>
        </div>
      }
    >
      {loading ? (
        <Pending height={280} />
      ) : error ? (
        <Failed message={error} />
      ) : !rows.length ? (
        <NoData />
      ) : (
        <ul className="grid gap-3.5">
          {rows.map((r) => {
            const above = r.rate > r.national_median;
            const times = r.national_median ? r.rate / r.national_median : NaN;
            return (
              <li key={r.type} className="grid grid-cols-[100px_1fr_92px] items-center gap-3 sm:grid-cols-[130px_1fr_120px]">
                <span className="text-[14px]">{r.label}</span>
                <div className="grid gap-1">
                  <div className="h-2.5 rounded-full bg-ink/[.05]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(r.rate / max) * 100}%`,
                        background: above ? heat[3] : green[3],
                      }}
                    />
                  </div>
                  <div className="h-1.5 rounded-full bg-ink/[.03]">
                    <div className="h-full rounded-full bg-slate/50" style={{ width: `${(r.national_median / max) * 100}%` }} />
                  </div>
                </div>
                <span className="text-right text-[13px] tabular-nums">
                  <span className="font-semibold">{int(r.rate)}</span>{" "}
                  <span className={above ? "text-warn" : "text-ok-deep"}>
                    {Number.isFinite(times) ? `${times.toFixed(1)}×` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Where the suburb sits among the 29: one crime/summary call per suburb (cached). */
function CityRankPanel({ suburb, onPick }: { suburb: string; onPick: (s: string) => void }) {
  const theme = useTheme();
  const heat = rampFor(RAMPS.heat, theme);
  const { names, call: listCall } = useSuburbList();
  const results = useApis<Summary>(names.map((n) => suburbPath(n, "crime/summary")));
  const [all, setAll] = useState(false);
  const ranked = names
    .map((name, i) => ({ name, rate: results[i]?.data?.suburb_median }))
    .filter((r): r is { name: string; rate: number } => typeof r.rate === "number")
    .sort((a, b) => b.rate - a.rate);
  const pos = ranked.findIndex((r) => r.name === suburb);
  const max = ranked[0]?.rate ?? 1;
  const loading = results.some((r) => r.loading) || !names.length;
  // Show the top five, the bottom three and the suburb with its neighbours.
  const keep = new Set<number>([0, 1, 2, 3, 4, ranked.length - 3, ranked.length - 2, ranked.length - 1, pos - 1, pos, pos + 1]);
  const rows = ranked.map((r, i) => (all || keep.has(i) ? { ...r, i } : null));

  return (
    <Panel
      title="Across the City of Sydney"
      note={
        pos >= 0
          ? `${shortName(suburb)} ranks ${ordinal(pos + 1)} of ${ranked.length} suburbs, highest crime first.`
          : "Every suburb's predicted rate, highest first."
      }
      calls={[listCall, ...results.map((r) => r.call)]}
      className="h-full"
    >
      {!ranked.length && loading ? (
        <Pending height={300} />
      ) : (
        <>
          <ol className="grid gap-0.5 text-[13px]">
            {rows.map((r, i) =>
              r ? (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => onPick(r.name)}
                    className={`grid w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-md px-1 py-1 text-left ${
                      r.name === suburb ? "bg-brand-wash" : "hover:bg-ink/[.04]"
                    }`}
                  >
                    <span className="text-right font-mono text-[10.5px] text-faint">{r.i + 1}</span>
                    <span className="min-w-0">
                      <span className={`block truncate ${r.name === suburb ? "font-semibold" : ""}`}>{shortName(r.name)}</span>
                      <span className="mt-1 block h-[3px] rounded-full bg-ink/[.06]">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(r.rate / max) * 100}%`, background: heat[r.name === suburb ? 4 : 2] }}
                        />
                      </span>
                    </span>
                    <span className="tabular-nums">{int(r.rate)}</span>
                  </button>
                </li>
              ) : rows[i - 1] ? (
                <li key={`gap-${i}`} className="py-0.5 text-center text-[12px] tracking-[.3em] text-faint">
                  ···
                </li>
              ) : null,
            )}
          </ol>
          <button
            type="button"
            onClick={() => setAll(!all)}
            className="mt-3 w-full rounded-lg border border-line py-1.5 text-[12.5px] text-slate hover:text-ink"
          >
            {all ? "Show fewer" : `Show all ${ranked.length}`}
          </button>
        </>
      )}
    </Panel>
  );
}

function BlockMapPanel({ suburb }: { suburb: string }) {
  const { data, call, loading, error } = useApi<ByBlock>(suburbPath(suburb, "crime/by-mesh-block"));
  const shapes = useSuburbShapes(suburb);
  const values = useMemo(() => new Map(Object.entries(data?.mesh_blocks ?? {})), [data]);
  const sorted = [...values.values()].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const hot = sorted.filter((v) => v >= p90).length;

  return (
    <Panel
      title="Block by block"
      note={
        data?.definition ??
        "Predicted incidents per 100,000 residents for each mesh block, the smallest area the census publishes."
      }
      calls={[call, ...shapes.calls]}
    >
      {loading || shapes.loading ? (
        <Pending height={520} />
      ) : error || shapes.error ? (
        <Failed message={(error ?? shapes.error)!} />
      ) : !shapes.shapes || !values.size ? (
        <NoData />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <ChoroplethMap
            shapes={shapes.shapes.features}
            outlines={shapes.boundary ? [{ id: suburb, feature: shapes.boundary }] : []}
            values={values}
            format={(n) => int(n)}
            ramp={RAMPS.heat}
            legend="Predicted incidents per 100,000 residents a year"
            caption={`Crime rate by mesh block in ${shortName(suburb)}`}
            maxHeight={540}
          />
          <dl className="grid content-start gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <Fact label="Blocks mapped" value={int(values.size)} />
            <Fact label="Middle block" value={int(mid)} sub="incidents per 100,000 a year" />
            <Fact
              label="Hottest tenth"
              value={`${int(p90)}+`}
              sub={`${hot} blocks at or above this rate`}
            />
          </dl>
        </div>
      )}
    </Panel>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink/[.02] px-4 py-3">
      <dt className="text-[12.5px] text-slate">{label}</dt>
      <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none tracking-[-0.02em]">{value}</dd>
      {sub && <dd className="mt-1.5 text-[12px] leading-[1.35] text-faint">{sub}</dd>}
    </div>
  );
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
