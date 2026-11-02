"use client";

import { useState } from "react";
import { ChoroplethMap } from "@/components/ChoroplethMap";
import { Pending } from "@/components/PageShell";
import { Choices } from "@/components/Pickers";
import { suburbPath } from "@/lib/api";
import { useApi } from "@/lib/api-store";
import { useSuburbShapes } from "@/lib/area";
import { LAYERS, type LayerBody, readLayer } from "@/lib/layers";

const KEYS = ["price", "rent", "income", "livability", "crime"];
const SHOWN = LAYERS.filter((l) => KEYS.includes(l.key));

/**
 * The suburb, block by block, over a base map. Loaded in the browser (the
 * polygons are the heaviest part of the report), so the page itself renders
 * straight away.
 */
export function ReportMap({ suburb }: { suburb: string }) {
  const [key, setKey] = useState("price");
  const layer = SHOWN.find((l) => l.key === key)!;
  const { shapes, boundary, loading } = useSuburbShapes(suburb);
  const body = useApi<LayerBody>(suburbPath(suburb, layer.tail));
  const { values, labels } = readLayer(body.data, layer, "lifestyle");

  return (
    <div>
      <Choices
        label="Map layer"
        size="sm"
        value={key}
        onChange={setKey}
        options={SHOWN.map((l) => ({ value: l.key, label: l.key === "livability" ? "Lifestyle score" : l.label }))}
      />
      <div className="mt-3">
        {loading || !shapes ? (
          <Pending height={420} />
        ) : (
          <ChoroplethMap
            shapes={shapes.features}
            outlines={boundary ? [{ id: suburb, feature: boundary }] : []}
            values={values}
            labels={labels}
            format={layer.format}
            ramp={layer.ramp}
            legend={layer.key === "livability" ? "Lifestyle score out of 100" : layer.legend}
            caption={`${layer.legend} by block in ${suburb}`}
            maxHeight={440}
            noDataLabel={layer.note ? "No figure (often apartment-only blocks)" : "No figure for the block"}
          />
        )}
      </div>
    </div>
  );
}
