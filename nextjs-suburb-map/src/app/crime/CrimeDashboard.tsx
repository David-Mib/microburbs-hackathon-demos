"use client";

import { useMemo } from "react";
import { ChoroplethMap, RAMPS } from "@/components/ChoroplethMap";
import { Failed, NoData, PageShell, Panel, Pending } from "@/components/PageShell";
import { SuburbSelect } from "@/components/Pickers";
import { EXAMPLE_SUBURB, shortName, suburbPath } from "@/lib/api";
import { useApi } from "@/lib/api-store";
import { useSuburbShapes } from "@/lib/area";
import { int } from "@/lib/format";
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
 * The dashboard is a list of panels. Each one takes the suburb and fetches
 * what it needs, so a new endpoint (block-level rent, crime by type per
 * block, …) is one more component and one more line here.
 */
const PANELS: { key: string; wide?: boolean; Component: (p: { suburb: string }) => React.ReactNode }[] = [
  { key: "headline", Component: HeadlinePanel },
  { key: "safety", Component: SafetyPanel },
  { key: "breakdown", wide: true, Component: BreakdownPanel },
  { key: "blocks", wide: true, Component: BlockMapPanel },
];

export function CrimeDashboard() {
  const [suburb, setSuburb] = useQueryParam("suburb", EXAMPLE_SUBURB);
  return (
    <PageShell slug="crime" controls={<SuburbSelect value={suburb} onChange={setSuburb} />}>
      <div className="grid gap-4 md:grid-cols-2">
        {PANELS.map(({ key, wide, Component }) => (
          <div key={`${key}-${suburb}`} className={wide ? "md:col-span-2" : ""}>
            <Component suburb={suburb} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function HeadlinePanel({ suburb }: { suburb: string }) {
  const { data, call, loading, error } = useApi<Summary>(suburbPath(suburb, "crime/summary"));
  const label = shortName(suburb);
  return (
    <Panel title="Against the national rate" calls={[call]} className="h-full">
      {loading ? (
        <Pending height={150} />
      ) : error ? (
        <Failed message={error} />
      ) : !data ? (
        <NoData />
      ) : (
        <div>
          <p className="text-[30px] font-semibold leading-none tracking-[-0.02em]">{data.verdict}</p>
          <p className="mt-3 text-[15px] leading-[1.5] text-slate">
            {label} runs at <strong className="text-ink">{int(data.suburb_median)}</strong> incidents per 100,000
            residents a year,{" "}
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
  const max = Math.max(suburb, national) * 1.25;
  const at = (v: number) => `${(v / max) * 100}%`;
  const above = suburb > national;
  return (
    <div className="mt-6 pb-8">
      <div className="relative h-2 rounded-full bg-ink/[.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: at(suburb), background: above ? RAMPS.heat[3] : RAMPS.green[3] }}
        />
        <div className="absolute -top-1.5 h-5 w-0.5 bg-ink" style={{ left: at(national) }} />
        <div
          className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[12px] text-slate"
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
    <Panel
      title="Safety score"
      note="0 to 100, higher means less predicted crime."
      calls={[call]}
      className="h-full"
    >
      {loading ? (
        <Pending height={120} />
      ) : error ? (
        <Failed message={error} />
      ) : !safety ? (
        <NoData />
      ) : (
        <div className="flex items-end gap-6">
          <Dial value={safety.value} />
          <div className="pb-2 text-[15px] leading-[1.5]">
            <p className="font-semibold">{safety.level}</p>
            {region != null && (
              <p className="text-slate">
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
  const r = 44;
  const c = Math.PI * r;
  const colour = value >= 60 ? RAMPS.green[3] : value >= 40 ? RAMPS.heat[2] : RAMPS.heat[3];
  return (
    <svg width="120" height="70" viewBox="0 0 120 70" role="img" aria-label={`Safety ${value} out of 100`}>
      <path d={`M16,62 A${r},${r} 0 0 1 104,62`} fill="none" stroke="var(--color-line)" strokeWidth="10" strokeLinecap="round" />
      <path
        d={`M16,62 A${r},${r} 0 0 1 104,62`}
        fill="none"
        stroke={colour}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
      />
      <text x="60" y="60" textAnchor="middle" className="fill-ink text-[26px] font-semibold">
        {value}
      </text>
    </svg>
  );
}

function BreakdownPanel({ suburb }: { suburb: string }) {
  const { data, call, loading, error } = useApi<Breakdown>(suburbPath(suburb, "crime/breakdown"));
  const rows = data?.breakdown ?? [];
  const max = Math.max(1, ...rows.flatMap((r) => [r.rate, r.national_median]));
  return (
    <Panel
      title="What drives it"
      note="Each offence type per 100,000 residents a year. The black tick is the national median."
      calls={[call]}
    >
      {loading ? (
        <Pending height={260} />
      ) : error ? (
        <Failed message={error} />
      ) : !rows.length ? (
        <NoData />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const above = r.diff_pct > 0;
            return (
              <li key={r.type} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 sm:grid-cols-[140px_1fr_96px]">
                <span className="text-[14px]">{r.label}</span>
                <div className="relative h-3.5 rounded-sm bg-ink/[.05]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${(r.rate / max) * 100}%`,
                      background: above ? RAMPS.heat[r.diff_pct > 50 ? 4 : 3] : RAMPS.green[3],
                    }}
                  />
                  <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${(r.national_median / max) * 100}%` }} />
                </div>
                <span className="text-right text-[13px] tabular-nums">
                  <span className="font-semibold">{int(r.rate)}</span>{" "}
                  <span className={above ? "text-warn" : "text-[#1b6450]"}>
                    {r.diff_pct > 0 ? "+" : ""}
                    {r.diff_pct}%
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

function BlockMapPanel({ suburb }: { suburb: string }) {
  const { data, call, loading, error } = useApi<ByBlock>(suburbPath(suburb, "crime/by-mesh-block"));
  const shapes = useSuburbShapes(suburb);
  const values = useMemo(() => new Map(Object.entries(data?.mesh_blocks ?? {})), [data]);
  const hottest = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

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
        <Pending height={380} />
      ) : error || shapes.error ? (
        <Failed message={(error ?? shapes.error)!} />
      ) : !shapes.shapes || !values.size ? (
        <NoData />
      ) : (
        <>
          <ChoroplethMap
            shapes={shapes.shapes.features}
            outlines={shapes.boundary ? [{ id: suburb, feature: shapes.boundary }] : []}
            values={values}
            format={(n) => int(n)}
            ramp={RAMPS.heat}
            legend="Predicted incidents per 100,000 residents a year"
            caption={`Crime rate by mesh block in ${shortName(suburb)}`}
          />
          <p className="mt-4 text-[14px] leading-[1.5] text-slate">
            {values.size} blocks. The three highest run at {hottest.map(([, v]) => int(v)).join(", ")}, against a
            suburb median of {int(median([...values.values()]))}.
          </p>
        </>
      )}
    </Panel>
  );
}

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}
