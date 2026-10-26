"use client";

import { useMemo, useState } from "react";
import type { Feature } from "@/lib/api";

export const RAMPS = {
  blue: ["#e3eafb", "#b3c7f4", "#7d9eec", "#4475e6", "#2447a8"],
  heat: ["#fcefd4", "#f6c98d", "#ed9a5e", "#d4583b", "#962a2b"],
  green: ["#e2f3ec", "#afdcc7", "#72bf9d", "#379673", "#1b6450"],
  violet: ["#ece8fb", "#cbc0f3", "#a393e6", "#7a64d4", "#4f3aa6"],
  teal: ["#e0f3f4", "#a9dde0", "#69bfc5", "#2f97a0", "#17636b"],
} as const;

const NO_DATA = "#e9edf2";
const W = 1000;

export type Outline = { id: string; label?: string; feature: Feature };
export type Marker = { id: string; lat: number; lng: number; label: string; tone?: "focus" | "dot" };

/**
 * Mesh blocks drawn from the API's GeoJSON, each filled by its value. Plain
 * SVG, no tiles and no map library: projecting GeoJSON is a dozen lines.
 *
 * - `shapes`   the mesh-block polygons (properties.mb is the block code)
 * - `values`   block code → number; blocks without one are grey
 * - `outlines` optional suburb outlines drawn on top (clickable)
 * - `markers`  optional points (a property, nearby sales)
 */
export function ChoroplethMap({
  shapes,
  outlines = [],
  values,
  labels,
  groups,
  markers = [],
  format,
  ramp,
  legend,
  caption,
  onOutlineClick,
  labelOutlines = false,
  maxHeight = 640,
  showCodes = true,
  hint,
  noDataLabel = "No figure for the block",
  hideLegend = false,
}: {
  shapes: Feature[];
  outlines?: Outline[];
  values: Map<string, number>;
  /** Block code → street name. */
  labels?: Map<string, string>;
  /** Block code → suburb, for maps that span several suburbs. */
  groups?: Map<string, string>;
  markers?: Marker[];
  format: (n: number) => string;
  ramp: readonly string[];
  legend: string;
  caption: string;
  onOutlineClick?: (id: string) => void;
  labelOutlines?: boolean;
  maxHeight?: number;
  /** Show the mesh-block code on hover (off when the shapes are whole suburbs). */
  showCodes?: boolean;
  /** Replaces the "Point at a block" prompt. */
  hint?: string;
  noDataLabel?: string;
  hideLegend?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [hoverMarker, setHoverMarker] = useState<Marker | null>(null);

  const proj = useMemo(() => project(shapes, outlines, markers), [shapes, outlines, markers]);
  const breaks = useMemo(() => quantileBreaks([...values.values()], ramp.length), [values, ramp.length]);
  const colour = (v: number | undefined) => {
    if (v == null) return NO_DATA;
    let i = 0;
    while (i < breaks.length && v > breaks[i]) i++;
    return ramp[Math.min(i, ramp.length - 1)];
  };

  const nums = [...values.values()];
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 0;
  const hv = hover ? values.get(hover) : undefined;

  return (
    <figure className="relative">
      <div
        className="pointer-events-none mb-2 min-h-[44px] rounded-lg bg-paper px-3 py-2 text-[13px] leading-[1.35] sm:absolute sm:left-0 sm:top-0 sm:z-10 sm:mb-0 sm:max-w-[70%] sm:bg-card/95 sm:shadow-[0_1px_0_var(--color-line)]"
        aria-live="polite"
      >
        {hoverMarker ? (
          <div className="font-semibold">{hoverMarker.label}</div>
        ) : hover ? (
          <>
            <div className="font-semibold">{hv != null ? format(hv) : "No figure"}</div>
            <div className="text-slate">
              {[labels?.get(hover), groups?.get(hover)].filter(Boolean).join(", ")}{" "}
              {showCodes && <span className="font-mono text-[11px] text-faint">block {hover}</span>}
            </div>
          </>
        ) : (
          <div className="text-slate">
            {hint ?? `Point at a block to read its value${onOutlineClick ? "; click to open the suburb" : ""}.`}
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${proj.height}`}
        className="mx-auto block w-full"
        style={{ maxHeight }}
        role="img"
        aria-label={`${caption}. Values range from ${format(min)} to ${format(max)}.`}
        onPointerLeave={() => {
          setHover(null);
          setHoverMarker(null);
        }}
      >
        <g className="cell-in">
          {proj.blocks.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill={colour(values.get(p.id))}
              stroke="#ffffff"
              strokeWidth={0.6}
              strokeLinejoin="round"
              onPointerEnter={() => {
                setHover(p.id);
                setHoverMarker(null);
              }}
              onClick={() => {
                setHover(p.id);
                const g = groups?.get(p.id);
                if (g && onOutlineClick) onOutlineClick(g);
              }}
              className={onOutlineClick ? "cursor-pointer" : undefined}
            />
          ))}
        </g>
        {proj.outlines.map((o) => (
          <path
            key={o.id}
            d={o.d}
            fill="none"
            stroke="var(--color-ink)"
            strokeOpacity={outlines.length > 1 ? 0.55 : 1}
            strokeWidth={outlines.length > 1 ? 1.2 : 1.6}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}
        {hover && (
          <path
            d={proj.blocks.find((p) => p.id === hover)?.d}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={2.2}
            pointerEvents="none"
          />
        )}
        {labelOutlines &&
          proj.outlines.map((o) =>
            o.label ? (
              <text
                key={`l-${o.id}`}
                x={o.cx}
                y={o.cy}
                textAnchor="middle"
                className="map-label text-[15px] font-semibold"
                pointerEvents="none"
              >
                {o.label}
              </text>
            ) : null,
          )}
        {proj.markers.map((m) => (
          <circle
            key={m.id}
            cx={m.x}
            cy={m.y}
            r={m.tone === "focus" ? 9 : 5}
            fill={m.tone === "focus" ? "var(--color-warn)" : "var(--color-ink)"}
            fillOpacity={m.tone === "focus" ? 1 : 0.75}
            stroke="#fff"
            strokeWidth={m.tone === "focus" ? 3 : 1.5}
            onPointerEnter={() => setHoverMarker(m)}
            onPointerLeave={() => setHoverMarker(null)}
          />
        ))}
      </svg>

      {!hideLegend && (
      <figcaption className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-slate">{legend}</div>
          <div className="mt-1.5 flex">
            {ramp.map((c, i) => (
              <div key={c} className="w-12 sm:w-16">
                <div className="h-2.5" style={{ background: c }} />
                <div className="mt-1 font-mono text-[10.5px] text-faint">
                  {i === 0 ? format(min) : breaks[i - 1] != null ? format(breaks[i - 1]) : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-faint">
          <span className="h-2.5 w-2.5" style={{ background: NO_DATA }} /> {noDataLabel}
        </div>
      </figcaption>
      )}
    </figure>
  );
}

/** Equirectangular projection, scaled by cos(latitude) so shapes keep their proportions. */
function project(blocks: Feature[], outlines: Outline[], markers: Marker[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity; // prettier-ignore
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const f of [...blocks, ...outlines.map((o) => o.feature)]) {
    for (const poly of polygons(f)) for (const ring of poly) for (const [x, y] of ring) grow(x, y);
  }
  for (const m of markers) grow(m.lng, m.lat);
  if (!Number.isFinite(minX)) return { blocks: [], outlines: [], markers: [], height: 300 };

  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const pad = 10;
  const scale = (W - pad * 2) / Math.max((maxX - minX) * k, 1e-9);
  const height = Math.max(Math.round((maxY - minY) * scale + pad * 2), 200);
  const px = (x: number) => (x - minX) * k * scale + pad;
  const py = (y: number) => (maxY - y) * scale + pad;
  const toPath = (f: Feature) =>
    polygons(f)
      .map((poly) =>
        poly.map((ring) => "M" + ring.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("L") + "Z").join(""),
      )
      .join("");
  /** Label point: the middle of the largest ring's bounding box. */
  const centre = (f: Feature) => {
    let best: number[][] = [];
    for (const poly of polygons(f)) if (poly[0] && poly[0].length > best.length) best = poly[0];
    const xs = best.map((p) => p[0]);
    const ys = best.map((p) => p[1]);
    return { cx: px((Math.min(...xs) + Math.max(...xs)) / 2), cy: py((Math.min(...ys) + Math.max(...ys)) / 2) };
  };

  return {
    blocks: blocks.map((f) => ({ id: String(f.properties.mb ?? ""), d: toPath(f) })),
    outlines: outlines.map((o) => ({ id: o.id, label: o.label, d: toPath(o.feature), ...centre(o.feature) })),
    markers: markers.map((m) => ({ ...m, x: px(m.lng), y: py(m.lat) })),
    height,
  };
}

function polygons(f: Feature): number[][][][] {
  const g = f.geometry;
  if (!g) return [];
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

/** n-1 upper bounds splitting the values into n equal-count classes. */
function quantileBreaks(values: number[], n: number): number[] {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return [];
  const out: number[] = [];
  for (let i = 1; i < n; i++) out.push(v[Math.min(v.length - 1, Math.floor((i / n) * v.length))]);
  return out;
}
