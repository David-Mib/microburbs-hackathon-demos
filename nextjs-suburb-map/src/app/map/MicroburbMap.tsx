"use client";

import { useMemo } from "react";
import { ChoroplethMap } from "@/components/ChoroplethMap";
import { Failed, NoData, PageShell, Panel, Pending } from "@/components/PageShell";
import { Choices, SuburbSelect } from "@/components/Pickers";
import { EXAMPLE_SUBURB, shortName, suburbPath } from "@/lib/api";
import { useApi } from "@/lib/api-store";
import { useSuburbShapes } from "@/lib/area";
import { DIMS, LAYERS, type LayerBody, readLayer } from "@/lib/layers";
import { useQueryParam } from "@/lib/use-query-param";

export function MicroburbMap() {
  const [suburb, setSuburb] = useQueryParam("suburb", EXAMPLE_SUBURB);
  const [layerKey, setLayer] = useQueryParam("layer", "price", LAYERS.map((l) => l.key));
  const [dim, setDim] = useQueryParam("score", "lifestyle", DIMS);
  const layer = LAYERS.find((l) => l.key === layerKey)!;

  const { data, call, loading, error } = useApi<LayerBody>(suburbPath(suburb, layer.tail));
  const shapes = useSuburbShapes(suburb);

  const { values, labels } = useMemo(() => readLayer(data, layer, dim), [data, layer, dim]);

  const ranked = [...values.entries()].filter(([mb]) => labels.has(mb)).sort((a, b) => b[1] - a[1]);
  const dimInfo = data?.dimensions?.find((d) => d.key === dim);
  const label = shortName(suburb);

  return (
    <PageShell
      slug="map"
      controls={
        <div className="grid gap-3">
          <SuburbSelect value={suburb} onChange={setSuburb} />
          <Choices
            label="Layer"
            value={layerKey}
            onChange={setLayer}
            options={LAYERS.map((l) => ({ value: l.key, label: l.label }))}
            size="sm"
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
      <Panel
        title={`${layer.legend} in ${label}${layer.key === "livability" ? `: ${dim}` : ""}`}
        note={[layer.key === "livability" ? dimInfo?.description : data?.definition, layer.note].filter(Boolean).join(" ")}
        calls={[call, ...shapes.calls]}
      >
        {loading || shapes.loading ? (
          <Pending height={420} />
        ) : error || shapes.error ? (
          <Failed message={(error ?? shapes.error)!} />
        ) : !shapes.shapes || !values.size ? (
          <NoData>The API has no {layer.label.toLowerCase()} figures for this suburb&apos;s blocks.</NoData>
        ) : (
          <ChoroplethMap
            key={`${suburb}-${layer.key}-${dim}`}
            shapes={shapes.shapes.features}
            outlines={shapes.boundary ? [{ id: suburb, feature: shapes.boundary }] : []}
            values={values}
            labels={labels}
            format={layer.format}
            ramp={layer.ramp}
            legend={layer.legend}
            caption={`${layer.legend} by mesh block in ${label}`}
          />
        )}
      </Panel>

      {ranked.length >= 6 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Ranking title="Highest blocks" rows={ranked.slice(0, 5)} labels={labels} format={layer.format} />
          <Ranking title="Lowest blocks" rows={ranked.slice(-5).reverse()} labels={labels} format={layer.format} />
        </div>
      )}
    </PageShell>
  );
}

function Ranking({
  title,
  rows,
  labels,
  format,
}: {
  title: string;
  rows: [string, number][];
  labels: Map<string, string>;
  format: (n: number) => string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card px-5 py-4 sm:px-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <ol className="mt-2 divide-y divide-line">
        {rows.map(([mb, v]) => (
          <li key={mb} className="flex items-baseline justify-between gap-3 py-2 text-[14px]">
            <span>
              {labels.get(mb)} <span className="font-mono text-[11px] text-faint">{mb}</span>
            </span>
            <span className="font-semibold tabular-nums">{format(v)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
