"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChoroplethMap, type Outline, rampFor } from "@/components/ChoroplethMap";
import { Failed, PageShell, Panel, Pending, Stat } from "@/components/PageShell";
import { Choices } from "@/components/Pickers";
import { type Feature, type FeatureCollection, shortName, suburbHref, suburbPath } from "@/lib/api";
import { type ApiResult, useApis } from "@/lib/api-store";
import { useSuburbList } from "@/lib/area";
import { DIMS, type LayerBody, readLayer } from "@/lib/layers";
import { useTheme } from "@/lib/theme";
import { useQueryParam } from "@/lib/use-query-param";
import { type Ethnicity, HeatGrid } from "./HeatGrid";
import { CENSUS_FIELDS, FAMILIES, METRICS, type Metric, metricByKey } from "./metrics";

type MeshBlocks = { geojson: FeatureCollection };
type Boundary = { geojson: Feature };
type Census = { fields: { field_code: string; value: number | null }[] };

const censusPath = (name: string) =>
  `/v1/area-stats/SAL/${encodeURIComponent(name)}/values?fields=${CENSUS_FIELDS.join(",")}`;

/**
 * The City of Sydney as heat maps. There is no city-wide endpoint, so every
 * map is the per-suburb answer repeated for the 29 suburbs in /v1/suburbs/list
 * and joined on the map: suburb outlines for suburb-level metrics, mesh
 * blocks for block-level ones. Switching between metrics of the same source
 * (two ancestries, two census fields) costs no new calls.
 */
export function HeatMaps() {
  const router = useRouter();
  const [mKey, setMetric] = useQueryParam("m", "ancestry", METRICS.map((m) => m.key));
  const [dim, setDim] = useQueryParam("score", "lifestyle", DIMS);
  const [group, setGroup] = useQueryParam("group", "Asians");
  const [country, setCountry] = useQueryParam("country", "China");
  const metric = metricByKey(mKey);
  const src = metric.source;

  const list = useSuburbList();
  const names = list.names;
  const each = (yes: boolean, path: (n: string) => string) => (yes ? names.map(path) : []);
  const bounds = useApis<Boundary>(each(true, (n) => suburbPath(n, "shapes/boundary")));
  const blocks = useApis<MeshBlocks>(each(src.kind === "block", (n) => suburbPath(n, "shapes/mesh-blocks")));
  const layers = useApis<LayerBody>(
    each(src.kind === "block", (n) => suburbPath(n, src.kind === "block" ? src.layer.tail : "")),
  );
  const eth = useApis<Ethnicity>(each(src.kind === "ethnicity", (n) => suburbPath(n, "ethnicity/all")));
  const census = useApis<Census>(each(src.kind === "census", censusPath));

  const sig = (rs: ApiResult<unknown>[]) => rs.map((r) => (r.data ? 1 : 0)).join("");
  const boundsSig = sig(bounds);
  const ethSig = sig(eth);
  const dataSig = [sig(blocks), sig(layers), ethSig, sig(census)].join("|");

  const outlines = useMemo(() => {
    const out: Outline[] = [];
    names.forEach((name, i) => {
      const b = bounds[i]?.data?.geojson;
      if (b) out.push({ id: name, label: shortName(name), feature: b });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsSig, names.length]);

  // Ancestry groups and birthplace countries, ordered by their city-wide share.
  const options = useMemo(() => {
    const tally = (pick: (e: Ethnicity) => { key: string; v: number }[]) => {
      const sum = new Map<string, number>();
      for (const r of eth) for (const { key, v } of r.data ? pick(r.data) : []) sum.set(key, (sum.get(key) ?? 0) + v);
      return [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    };
    return {
      ancestry: tally((e) => e.ancestry.map((a) => ({ key: a.ancestry, v: a.proportion }))),
      birthplace: tally((e) => e.birthplace.map((b) => ({ key: b.country, v: b.proportion }))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethSig]);

  const view = useMemo(() => {
    // Suburb-level metrics: one value per suburb outline.
    if (src.kind !== "block") {
      const values = new Map<string, number>();
      names.forEach((name, i) => {
        let v: number | null | undefined;
        if (src.kind === "ethnicity") {
          const e = eth[i]?.data;
          v =
            src.dim === "ancestry"
              ? e?.ancestry.find((a) => a.ancestry === group)?.proportion
              : e?.birthplace.find((b) => b.country === country)?.proportion;
        } else {
          v = census[i]?.data?.fields.find((f) => f.field_code === src.field)?.value;
        }
        if (typeof v === "number" && Number.isFinite(v)) values.set(name, v);
      });
      const shapes = outlines.map((o) => ({ ...o.feature, properties: { id: o.id } }));
      const labels = new Map(names.map((n) => [n, shortName(n)]));
      const ranking = [...values.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      return { shapes, values, labels, groups: undefined, ranking, unit: "suburb" as const };
    }

    // Block-level metrics: mesh blocks joined to the layer on the block code.
    const shapes: Feature[] = [];
    const groups = new Map<string, string>();
    names.forEach((name, i) => {
      for (const f of blocks[i]?.data?.geojson.features ?? []) {
        shapes.push(f);
        groups.set(String(f.properties.mb), name);
      }
    });
    const acc = { values: new Map<string, number>(), labels: new Map<string, string>() };
    for (const r of layers) readLayer(r.data, src.layer, dim, acc);
    const per = new Map<string, number[]>();
    for (const [mb, v] of acc.values) {
      const s = groups.get(mb);
      if (s) per.set(s, [...(per.get(s) ?? []), v]);
    }
    const ranking = [...per.entries()]
      .map(([name, vs]) => ({ name, value: median(vs) }))
      .sort((a, b) => b.value - a.value);
    return { shapes, values: acc.values, labels: acc.labels, groups, ranking, unit: "block" as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mKey, dim, group, country, outlines, dataSig]);

  const sources = [bounds, blocks, layers, eth, census].flat();
  const back = sources.filter((r) => !r.loading).length;
  const loading = !names.length || back < sources.length;
  const error = list.error ?? sources.find((r) => r.error)?.error;
  const calls = [list.call, ...sources.map((r) => r.call)];
  const dimInfo = layers.find((r) => r.data?.dimensions)?.data?.dimensions?.find((d) => d.key === dim);

  const sub =
    src.kind === "ethnicity" ? (src.dim === "ancestry" ? group : country) : mKey === "livability" ? cap(dim) : null;
  const title = sub ? `${metric.label}: ${sub}` : metric.legend;
  const open = (name: string) => router.push(suburbHref(name));
  const ready = view.shapes.length > 0;

  return (
    <PageShell
      slug="heatmaps"
      eyebrow="City of Sydney · 29 suburbs"
      controls={<MetricPicker value={mKey} onChange={setMetric} />}
    >
      <div className="grid gap-4">
        {/* Second-level picker: which ancestry, country or livability dimension. */}
        {src.kind === "ethnicity" && (
          <Choices
            label={src.dim === "ancestry" ? "Ancestry" : "Country of birth"}
            value={src.dim === "ancestry" ? group : country}
            onChange={src.dim === "ancestry" ? setGroup : setCountry}
            options={(src.dim === "ancestry" ? options.ancestry : options.birthplace.slice(0, 18)).map((v) => ({
              value: v,
              label: v,
            }))}
            size="sm"
          />
        )}
        {mKey === "livability" && (
          <Choices
            label="Livability score"
            value={dim}
            onChange={setDim}
            options={DIMS.map((d) => ({ value: d, label: cap(d) }))}
            size="sm"
          />
        )}

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel
            title={title}
            note={
              <>
                {mKey === "livability" && dimInfo ? dimInfo.description : metric.blurb}{" "}
                {src.kind === "block" && src.layer.note ? src.layer.note : ""}
                <Progress back={back} all={sources.length} names={names.length} unit={view.unit} n={view.values.size} />
              </>
            }
            calls={calls}
          >
            {error && !loading && !ready ? (
              <Failed message={error} />
            ) : !ready ? (
              <Pending height={620} />
            ) : (
              <ChoroplethMap
                shapes={view.shapes}
                outlines={outlines}
                values={view.values}
                labels={view.labels}
                groups={view.groups}
                format={metric.format}
                ramp={metric.ramp}
                legend={sub ? `${metric.legend}: ${sub}` : metric.legend}
                caption={`${title} across the City of Sydney`}
                onOutlineClick={open}
                labelOutlines
                showCodes={view.unit === "block"}
                maxHeight={680}
                hint={`Point at a ${view.unit} to read it; click to open the suburb report.`}
                noDataLabel={view.unit === "block" ? "No figure for the block" : "No figure for the suburb"}
              />
            )}
          </Panel>

          <Sidebar metric={metric} ranking={view.ranking} loading={loading} unit={view.unit} sub={sub} />
        </div>

        {src.kind === "ethnicity" && (
          <Panel
            title={src.dim === "ancestry" ? "The city's ancestry mix" : "Where people were born"}
            note="Every suburb against every group. Each column has its own colour scale, so the hotspots of small groups show too. Click a column to map it, a suburb to open its report."
            calls={eth.map((r) => r.call)}
          >
            {!options.ancestry.length ? (
              <Pending height={420} />
            ) : (
              <HeatGrid
                names={names}
                data={eth.map((r) => r.data)}
                dim={src.dim}
                columns={src.dim === "ancestry" ? options.ancestry : options.birthplace.slice(0, 10)}
                active={src.dim === "ancestry" ? group : country}
                onColumn={src.dim === "ancestry" ? setGroup : setCountry}
              />
            )}
          </Panel>
        )}
      </div>
    </PageShell>
  );
}

/** Metric tiles grouped by family, each with its colour ramp as a swatch. */
function MetricPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const theme = useTheme();
  return (
    <>
      {/* Phones: one scrolling row of chips per family. */}
      <div className="grid gap-2 md:hidden">
        {FAMILIES.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <span className="w-[62px] shrink-0 text-[11px] font-semibold uppercase tracking-[.1em] text-faint">{f.label}</span>
            <div role="radiogroup" aria-label={f.label} className="-mr-4 flex gap-1.5 overflow-x-auto pr-4">
              {METRICS.filter((m) => m.family === f.key).map((m) => {
                const on = m.key === value;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(m.key)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
                      on ? "border-brand bg-brand-wash font-medium text-ink" : "border-line bg-card text-slate"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: rampFor(m.ramp, theme)[3] }}
                    />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-3">
      {FAMILIES.map((f) => (
        <div key={f.key} className="rounded-2xl border border-line bg-card p-3 shadow-card">
          <div className="flex items-baseline justify-between gap-2 px-1.5 pb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[.1em] text-ink">{f.label}</span>
            <span className="truncate text-[12px] text-faint">{f.blurb}</span>
          </div>
          <div role="radiogroup" aria-label={f.label} className="grid grid-cols-2 gap-1.5">
            {METRICS.filter((m) => m.family === f.key).map((m) => {
              const on = m.key === value;
              const ramp = rampFor(m.ramp, theme);
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(m.key)}
                  className={`group rounded-xl border px-2.5 py-2 text-left transition ${
                    on ? "border-brand bg-brand-wash" : "border-transparent hover:border-line hover:bg-ink/[.03]"
                  }`}
                >
                  <span className={`block text-[13.5px] ${on ? "font-semibold text-ink" : "text-slate group-hover:text-ink"}`}>
                    {m.label}
                  </span>
                  <span
                    className="mt-1.5 block h-1.5 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${ramp.join(",")})`, opacity: on ? 1 : 0.6 }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </>
  );
}

function Progress({ back, all, names, unit, n }: { back: number; all: number; names: number; unit: string; n: number }) {
  if (!names) return <span className="mt-2 block text-[12.5px] text-faint">Fetching the suburb list…</span>;
  const done = back >= all;
  return (
    <span className="mt-2 flex items-center gap-3 text-[12.5px] text-faint" aria-live="polite">
      <span className="relative h-1 w-24 shrink-0 overflow-hidden rounded-full bg-ink/10">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${all ? (back / all) * 100 : 0}%` }}
        />
      </span>
      {done
        ? `${n.toLocaleString("en-AU")} ${unit}s with a figure, from ${all + 1} calls`
        : `${back} of ${all} calls back: suburbs fill in as they land`}
    </span>
  );
}

/** Headline numbers and the suburb league table. */
function Sidebar({
  metric,
  ranking,
  loading,
  unit,
  sub,
}: {
  metric: Metric;
  ranking: { name: string; value: number }[];
  loading: boolean;
  unit: "block" | "suburb";
  sub: string | null;
}) {
  const [all, setAll] = useState(false);
  const theme = useTheme();
  const ramp = rampFor(metric.ramp, theme);
  if (!ranking.length) {
    return (
      <div className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-1">
        <Pending height={170} />
        <Pending height={420} />
      </div>
    );
  }
  const top = ranking[0];
  const bottom = ranking[ranking.length - 1];
  const mid = median(ranking.map((r) => r.value));
  const max = Math.max(...ranking.map((r) => Math.abs(r.value))) || 1;
  const n = ranking.length;
  const shown: ({ name: string; value: number; rank: number } | null)[] = ranking.map((r, i) => ({ ...r, rank: i + 1 }));
  const list = all || n <= 12 ? shown : [...shown.slice(0, 6), null, ...shown.slice(-5)];
  const colourAt = (rank: number) => ramp[Math.min(ramp.length - 1, Math.floor((1 - (rank - 1) / n) * ramp.length))];

  return (
    <div className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-1">
      <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Highest" value={metric.format(top.value)} sub={shortName(top.name)} />
          <Stat label="Lowest" value={metric.format(bottom.value)} sub={shortName(bottom.name)} />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <Stat
            label={unit === "block" ? "Middle suburb, by its median block" : "Middle suburb"}
            value={metric.format(mid)}
            sub={`${n} suburbs ranked${loading ? ", more loading" : ""}`}
          />
        </div>
        <div
          className="mt-4 h-2 rounded-full"
          style={{ background: `linear-gradient(90deg, ${ramp.join(",")})` }}
          aria-hidden="true"
        />
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint">
          <span>{metric.format(bottom.value)}</span>
          <span>{metric.format(top.value)}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Suburbs, highest first</h2>
        <p className="mt-1 text-[12.5px] leading-[1.4] text-slate">
          {unit === "block" ? "The middle block value in each suburb." : `${metric.legend}${sub ? `: ${sub}` : ""}.`}
        </p>
        <ol className="mt-3 grid gap-0.5 text-[13px]">
          {list.map((r) =>
            r == null ? (
              <li key="gap" className="py-0.5 text-center text-[12px] tracking-[.3em] text-faint">
                ···
              </li>
            ) : (
              <li key={r.name}>
                <Link
                  href={suburbHref(r.name)}
                  className="grid grid-cols-[20px_1fr_auto] items-center gap-x-2 rounded-md px-1 py-1 hover:bg-ink/[.04]"
                >
                  <span className="text-right font-mono text-[10.5px] text-faint">{r.rank}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{shortName(r.name)}</span>
                    <span className="mt-1 block h-[3px] rounded-full bg-ink/[.06]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max(3, (Math.abs(r.value) / max) * 100)}%`, background: colourAt(r.rank) }}
                      />
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{metric.format(r.value)}</span>
                </Link>
              </li>
            ),
          )}
        </ol>
        {n > 12 && (
          <button
            type="button"
            onClick={() => setAll(!all)}
            className="mt-3 w-full rounded-lg border border-line py-1.5 text-[12.5px] text-slate hover:text-ink"
          >
            {all ? "Show top and bottom only" : `Show all ${n}`}
          </button>
        )}
      </section>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}
