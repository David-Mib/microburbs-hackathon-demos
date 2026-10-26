"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ChoroplethMap, type Outline } from "@/components/ChoroplethMap";
import { Failed, PageShell, Panel, Pending } from "@/components/PageShell";
import { Choices } from "@/components/Pickers";
import { type Feature, type FeatureCollection, shortName, suburbPath } from "@/lib/api";
import { useApis } from "@/lib/api-store";
import { useSuburbList } from "@/lib/area";
import { DIMS, LAYERS, type LayerBody, readLayer } from "@/lib/layers";
import { useQueryParam } from "@/lib/use-query-param";

type MeshBlocks = { geojson: FeatureCollection };
type Boundary = { geojson: Feature };

/**
 * The whole City of Sydney, block by block. There is no city-wide endpoint, so
 * this is the per-suburb map repeated 29 times: for each suburb in
 * /v1/suburbs/list, its mesh blocks, its outline and one layer, all joined on
 * the block code. The app's server paces the calls and caches the answers.
 */
export function CityMap() {
  const router = useRouter();
  const [layerKey, setLayer] = useQueryParam("layer", "income", LAYERS.map((l) => l.key));
  const [dim, setDim] = useQueryParam("score", "lifestyle", DIMS);
  const layer = LAYERS.find((l) => l.key === layerKey)!;

  const list = useSuburbList();
  const names = list.names;
  const blocks = useApis<MeshBlocks>(names.map((n) => suburbPath(n, "shapes/mesh-blocks")));
  const bounds = useApis<Boundary>(names.map((n) => suburbPath(n, "shapes/boundary")));
  const layers = useApis<LayerBody>(names.map((n) => suburbPath(n, layer.tail)));

  // Recompute only when another response lands, not on every render.
  const shapeSig = blocks.map((r) => (r.data ? 1 : 0)).join("") + bounds.map((r) => (r.data ? 1 : 0)).join("");
  const layerSig = layers.map((r) => (r.data ? 1 : 0)).join("") + layer.key + dim;

  const { features, groups, outlines } = useMemo(() => {
    const features: Feature[] = [];
    const groups = new Map<string, string>();
    const outlines: Outline[] = [];
    names.forEach((name, i) => {
      for (const f of blocks[i]?.data?.geojson.features ?? []) {
        features.push(f);
        groups.set(String(f.properties.mb), name);
      }
      const b = bounds[i]?.data?.geojson;
      if (b) outlines.push({ id: name, label: shortName(name), feature: b });
    });
    return { features, groups, outlines };
  }, [shapeSig]);

  const { values, labels } = useMemo(() => {
    const acc = { values: new Map<string, number>(), labels: new Map<string, string>() };
    for (const r of layers) readLayer(r.data, layer, dim, acc);
    return acc;
  }, [layerSig]);

  // Suburb league table: the median of each suburb's block values.
  const ranking = useMemo(() => {
    const per = new Map<string, number[]>();
    for (const [mb, v] of values) {
      const s = groups.get(mb);
      if (s) per.set(s, [...(per.get(s) ?? []), v]);
    }
    return [...per.entries()]
      .map(([name, vs]) => ({ name, median: median(vs), n: vs.length }))
      .sort((a, b) => b.median - a.median);
  }, [values, groups]);

  const all = [...blocks, ...bounds, ...layers];
  const back = all.filter((r) => !r.loading).length;
  const calls = [list.call, ...all.map((r) => r.call)];
  const error = list.error ?? all.find((r) => r.error)?.error;
  const dimInfo = layers.find((r) => r.data?.dimensions)?.data?.dimensions?.find((d) => d.key === dim);
  const open = (name: string) => router.push(`/search?suburb=${encodeURIComponent(name)}`);

  return (
    <PageShell
      slug="city"
      controls={
        <div className="grid gap-3">
          <Choices
            label="Layer"
            value={layerKey}
            onChange={setLayer}
            options={LAYERS.map((l) => ({ value: l.key, label: l.label }))}
          />
          {layer.key === "livability" && (
            <Choices
              label="Livability score"
              value={dim}
              onChange={setDim}
              options={DIMS.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))}
              size="sm"
            />
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        <Panel
          title={`${layer.legend}${layer.key === "livability" ? `: ${dim}` : ""}, every block of the City of Sydney`}
          note={
            <>
              {[layer.key === "livability" ? dimInfo?.description : undefined, layer.note].filter(Boolean).join(" ")}{" "}
              <span aria-live="polite">
                {names.length
                  ? back < all.length
                    ? `${back} of ${all.length} calls back: suburbs fill in as they land.`
                    : `${features.length.toLocaleString("en-AU")} mesh blocks in ${names.length} suburbs, from ${all.length + 1} calls.`
                  : "Fetching the suburb list…"}
              </span>
            </>
          }
          calls={calls}
        >
          {error && back === all.length && !features.length ? (
            <Failed message={error} />
          ) : !features.length ? (
            <Pending height={560} />
          ) : (
            <ChoroplethMap
              shapes={features}
              outlines={outlines}
              values={values}
              labels={labels}
              groups={groups}
              format={layer.format}
              ramp={layer.ramp}
              legend={layer.legend}
              caption={`${layer.legend} by mesh block across the City of Sydney`}
              onOutlineClick={open}
              labelOutlines
              maxHeight={760}
            />
          )}
        </Panel>

        <Panel title="Suburbs, highest first" note="The middle block value in each suburb." calls={[]}>
          {!ranking.length ? (
            <Pending height={400} />
          ) : (
            <ol className="grid gap-x-6 gap-y-1 text-[13.5px] sm:grid-cols-2 xl:grid-cols-3">
              {ranking.map((r, i) => (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => open(r.name)}
                    className="grid w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded px-1 py-1 text-left hover:bg-ink/[.04]"
                  >
                    <span className="text-right font-mono text-[11px] text-faint">{i + 1}</span>
                    <span className="relative truncate">
                      <span
                        className="absolute inset-y-0 left-0 -z-0 rounded-sm bg-brand-wash"
                        style={{ width: `${(Math.abs(r.median) / Math.abs(ranking[0].median || 1)) * 100}%` }}
                      />
                      <span className="relative">{shortName(r.name)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{layer.format(r.median)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}
