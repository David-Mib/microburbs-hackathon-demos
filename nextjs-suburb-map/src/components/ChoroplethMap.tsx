"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature } from "@/lib/api";
import { type Theme, useTheme } from "@/lib/theme";

/** Sequential colour ramps, low → high. Each has a twin tuned for the dark base map. */
export const RAMPS = {
  blue: ["#dbe5fb", "#a9c0f2", "#6f94e8", "#3f6fe0", "#1f3f9c"],
  heat: ["#fdecc8", "#f8c27f", "#ef8d52", "#d4523a", "#8f2330"],
  green: ["#dcf1e7", "#a6dbc2", "#62bb95", "#2b9068", "#145e47"],
  violet: ["#e9e4fb", "#c6b9f2", "#9a86e4", "#7058cf", "#4a339f"],
  teal: ["#d9f1f2", "#a0d9dc", "#5fbbc1", "#25929b", "#115f66"],
  magma: ["#fde0c5", "#f9a07a", "#e3566a", "#a3307e", "#4d1a6b"],
} as const;

const DARK_RAMPS = new Map<readonly string[], readonly string[]>([
  [RAMPS.blue, ["#1c2a5a", "#233f94", "#3264d2", "#5e93ff", "#acc9ff"]],
  [RAMPS.heat, ["#3a1c2c", "#7a2938", "#c3423e", "#f27c40", "#ffc56e"]],
  [RAMPS.green, ["#11302a", "#135946", "#188866", "#33c18b", "#93f2c2"]],
  [RAMPS.violet, ["#271c4b", "#452f8a", "#6a4ad0", "#9c7fff", "#d5c6ff"]],
  [RAMPS.teal, ["#0e2e36", "#10535d", "#137f89", "#21b4bc", "#84e8e8"]],
  [RAMPS.magma, ["#2b1145", "#6a1f7a", "#b5367a", "#f0645b", "#fcc58c"]],
]);

/** The ramp to draw with: the dark twin on the dark map. */
export const rampFor = (ramp: readonly string[], theme: Theme) =>
  theme === "dark" ? (DARK_RAMPS.get(ramp) ?? ramp) : ramp;

/**
 * Free, keyless vector base maps from OpenFreeMap (OpenStreetMap data,
 * commercial use allowed with attribution). "dark" for dark mode, "positron"
 * for light.
 */
export const baseStyle = (theme: Theme) => `https://tiles.openfreemap.org/styles/${theme === "dark" ? "dark" : "positron"}`;

export type Outline = { id: string; label?: string; feature: Feature };
export type Marker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone?: "focus" | "dot";
  /** Overrides the dot colour. */
  color?: string;
};

type Props = {
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
  onMarkerClick?: (id: string) => void;
  labelOutlines?: boolean;
  /** Map height in px (capped to 70% of the viewport on phones). */
  maxHeight?: number;
  /** Show the mesh-block code on hover (off when the shapes are whole suburbs). */
  showCodes?: boolean;
  /** Replaces the "Point at a block" prompt. */
  hint?: string;
  noDataLabel?: string;
  hideLegend?: boolean;
  /** Fill opacity of the coloured shapes over the base map. */
  opacity?: number;
};

/**
 * Shapes from the API's GeoJSON, coloured by value, over a real base map.
 * MapLibre GL draws it; the polygons are semi-transparent so streets and
 * parks show through.
 *
 * - `shapes`   polygons (properties.mb is the mesh-block code, or set properties.id)
 * - `values`   shape id → number; shapes without one are drawn faintly
 * - `outlines` optional suburb outlines drawn on top (clickable)
 * - `markers`  optional points (a property, nearby sales, listings)
 */
export function ChoroplethMap(props: Props) {
  const {
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
    maxHeight = 560,
    showCodes = true,
    hint,
    noDataLabel = "No figure for the block",
    hideLegend = false,
  } = props;
  const theme = useTheme();
  const colours = rampFor(ramp, theme);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverMarker, setHoverMarker] = useState<Marker | null>(null);

  const breaks = useMemo(() => quantileBreaks([...values.values()], ramp.length), [values, ramp.length]);
  const nums = [...values.values()];
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 0;
  const hv = hover ? values.get(hover) : undefined;

  const data = useMemo(() => {
    const colour = (v: number | undefined) => {
      if (v == null) return null;
      let i = 0;
      while (i < breaks.length && v > breaks[i]) i++;
      return colours[Math.min(i, colours.length - 1)];
    };
    return {
      blocks: fc(
        shapes.map((f) => {
          const id = shapeId(f);
          return { ...f, properties: { id, color: colour(values.get(id)) ?? "" } };
        }),
      ),
      outlines: fc(outlines.map((o) => ({ ...o.feature, properties: { id: o.id } }))),
      labels: fc(
        props.labelOutlines
          ? outlines.flatMap((o) => {
              const c = labelPoint(o.feature);
              return o.label && c ? [point(c, { label: o.label })] : [];
            })
          : [],
      ),
      markers: fc(
        markers.map((m) =>
          point([m.lng, m.lat], {
            id: m.id,
            focus: m.tone === "focus" ? 1 : 0,
            color: m.color ?? (m.tone === "focus" ? "#ff7a45" : theme === "dark" ? "#e9eef7" : "#0d1726"),
          }),
        ),
      ),
    };
  }, [shapes, outlines, markers, values, breaks, colours, theme, props.labelOutlines]);

  const bounds = useMemo(() => bbox(shapes, outlines, markers), [shapes, outlines, markers]);

  return (
    <figure className="relative">
      <div className="relative overflow-hidden rounded-xl border border-line bg-[var(--map-bg)]">
        <MapCanvas
          data={data}
          bounds={bounds}
          theme={theme}
          height={maxHeight}
          opacity={props.opacity ?? (theme === "dark" ? 0.72 : 0.66)}
          hover={hover}
          clickable={!!onOutlineClick}
          ariaLabel={`${caption}. Values range from ${format(min)} to ${format(max)}.`}
          onHover={(id) => {
            setHover(id);
            if (id) setHoverMarker(null);
          }}
          onMarkerHover={(id) => setHoverMarker(id ? (markers.find((m) => m.id === id) ?? null) : null)}
          onBlockClick={(id) => {
            const g = groups?.get(id);
            if (onOutlineClick) onOutlineClick(g ?? id);
          }}
          onMarkerClick={props.onMarkerClick}
        />
        <div
          className="pointer-events-none absolute left-3 top-3 z-10 max-w-[75%] rounded-lg border border-line bg-card/90 px-3 py-2 text-[13px] leading-[1.35] shadow-card backdrop-blur"
          aria-live="polite"
        >
          {hoverMarker ? (
            <div className="font-semibold">{hoverMarker.label}</div>
          ) : hover ? (
            <>
              <div className="font-semibold tabular-nums">{hv != null ? format(hv) : "No figure"}</div>
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
      </div>

      {!hideLegend && (
        <figcaption className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[13px] text-slate">{legend}</div>
            <div className="mt-1.5 flex">
              {colours.map((c, i) => (
                <div key={c} className="w-12 sm:w-16">
                  <div
                    className={`h-2.5 ${i === 0 ? "rounded-l-full" : ""} ${i === colours.length - 1 ? "rounded-r-full" : ""}`}
                    style={{ background: c }}
                  />
                  <div className="mt-1 font-mono text-[10.5px] text-faint">
                    {i === 0 ? format(min) : breaks[i - 1] != null ? format(breaks[i - 1]) : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-faint">
            <span className="h-2.5 w-2.5 rounded-sm border border-line bg-ink/10" /> {noDataLabel}
          </div>
        </figcaption>
      )}
    </figure>
  );
}

type MapData = {
  blocks: GeoJSON.FeatureCollection;
  outlines: GeoJSON.FeatureCollection;
  labels: GeoJSON.FeatureCollection;
  markers: GeoJSON.FeatureCollection;
};

/**
 * The MapLibre canvas. Created once; a theme change swaps the base style and
 * re-adds our layers, a data change just updates the sources.
 */
function MapCanvas({
  data,
  bounds,
  theme,
  height,
  opacity,
  hover,
  clickable,
  ariaLabel,
  onHover,
  onMarkerHover,
  onBlockClick,
  onMarkerClick,
}: {
  data: MapData;
  bounds: [number, number, number, number] | null;
  theme: Theme;
  height: number;
  opacity: number;
  hover: string | null;
  clickable: boolean;
  ariaLabel: string;
  onHover: (id: string | null) => void;
  onMarkerHover: (id: string | null) => void;
  onBlockClick: (id: string) => void;
  onMarkerClick?: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  // Latest props for the map's event handlers, which are bound once.
  const live = useRef({ data, theme, opacity, onHover, onMarkerHover, onBlockClick, onMarkerClick, clickable });
  live.current = { data, theme, opacity, onHover, onMarkerHover, onBlockClick, onMarkerClick, clickable };
  const fitted = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    let created: MlMap | undefined;
    import("maplibre-gl").then((ml) => {
      if (cancelled || !el.current) return;
      // MapLibre parses tiles in a web worker. `npm install` copies the worker
      // into public/ (see "postinstall" in package.json) so it loads from here.
      ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new ml.Map({
        container: el.current,
        style: baseStyle(live.current.theme),
        center: [151.205, -33.885],
        zoom: 12,
        // The tiles carry their own attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap).
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("style.load", () => {
        addLayers(m, live.current.data, live.current.theme, live.current.opacity);
        setReady(true);
      });
      const pointer = (on: boolean) => (m.getCanvas().style.cursor = on ? "pointer" : "");
      m.on("mousemove", "blocks-fill", (e) => {
        live.current.onHover(String(e.features?.[0]?.properties?.id ?? ""));
        pointer(live.current.clickable);
      });
      m.on("mouseleave", "blocks-fill", () => {
        live.current.onHover(null);
        pointer(false);
      });
      m.on("click", "blocks-fill", (e) => {
        const id = String(e.features?.[0]?.properties?.id ?? "");
        live.current.onHover(id);
        if (id) live.current.onBlockClick(id);
      });
      m.on("mousemove", "markers", (e) => {
        live.current.onMarkerHover(String(e.features?.[0]?.properties?.id ?? ""));
        pointer(!!live.current.onMarkerClick);
      });
      m.on("mouseleave", "markers", () => {
        live.current.onMarkerHover(null);
        pointer(false);
      });
      m.on("click", "markers", (e) => {
        const id = String(e.features?.[0]?.properties?.id ?? "");
        if (id) live.current.onMarkerClick?.(id);
      });
      map.current = created = m;
    });
    return () => {
      cancelled = true;
      created?.remove();
      map.current = null;
    };
  }, []);

  // Theme: swap the base map; style.load re-adds our layers.
  const styleTheme = useRef(theme);
  useEffect(() => {
    if (!map.current || styleTheme.current === theme) return;
    styleTheme.current = theme;
    map.current.setStyle(baseStyle(theme));
  }, [theme]);

  // Data: update the sources in place.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getSource("blocks")) return;
    for (const k of ["blocks", "outlines", "labels", "markers"] as const) (m.getSource(k) as GeoJSONSource).setData(data[k]);
  }, [data, ready]);

  // Frame the data once per new area.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !bounds) return;
    const key = bounds.map((n) => n.toFixed(3)).join(",");
    if (fitted.current === key) return;
    const first = !fitted.current;
    fitted.current = key;
    m.fitBounds(bounds, { padding: { top: 56, bottom: 24, left: 24, right: 24 }, duration: first ? 0 : 600, maxZoom: 16 });
  }, [bounds, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("blocks-hover")) return;
    m.setFilter("blocks-hover", ["==", ["get", "id"], hover ?? ""]);
  }, [hover, ready]);

  return (
    <div
      ref={el}
      role="img"
      aria-label={ariaLabel}
      className="w-full"
      style={{ height: `min(${height}px, 72dvh)`, minHeight: 300 }}
    />
  );
}

/** Quieten the base map so the data reads first: softer roads, our own background and water. */
function tuneBase(m: MlMap, dark: boolean) {
  for (const l of m.getStyle().layers) {
    if (l.type === "background") m.setPaintProperty(l.id, "background-color", dark ? "#0b111c" : "#f1f3f6");
    else if (l.type === "fill" && /water/.test(l.id)) m.setPaintProperty(l.id, "fill-color", dark ? "#0c1a2c" : "#d6e4f2");
    else if (l.type === "line" && /road|highway|bridge|tunnel|rail|transit|path/.test(l.id))
      m.setPaintProperty(l.id, "line-opacity", dark ? 0.32 : 0.7);
  }
}

function addLayers(m: MlMap, data: MapData, theme: Theme, opacity: number) {
  const dark = theme === "dark";
  const ink = dark ? "#e9eef7" : "#0d1726";
  tuneBase(m, dark);
  for (const k of ["blocks", "outlines", "labels", "markers"] as const) {
    if (!m.getSource(k)) m.addSource(k, { type: "geojson", data: data[k] });
  }
  // Our fills go above the base map's buildings (which would otherwise black out the
  // middle of a dense suburb) and under its roads and labels, so streets stay readable.
  const layers = m.getStyle().layers;
  const lastBuilding = layers.map((l) => l.id).findLastIndex((id) => /building/.test(id));
  const firstLabel = layers.slice(lastBuilding + 1).find((l) => l.type === "symbol" || l.type === "line")?.id;
  m.addLayer({
    id: "blocks-fill",
    type: "fill",
    source: "blocks",
    paint: {
      "fill-color": ["case", ["==", ["get", "color"], ""], dark ? "#94a3b8" : "#64748b", ["get", "color"]],
      "fill-opacity": ["case", ["==", ["get", "color"], ""], 0.08, opacity],
    },
  }, firstLabel);
  m.addLayer({
    id: "blocks-line",
    type: "line",
    source: "blocks",
    paint: { "line-color": dark ? "#0b1220" : "#ffffff", "line-opacity": dark ? 0.55 : 0.8, "line-width": 0.6 },
  }, firstLabel);
  m.addLayer({
    id: "outlines-line",
    type: "line",
    source: "outlines",
    paint: { "line-color": ink, "line-opacity": 0.75, "line-width": 1.4 },
  });
  m.addLayer({
    id: "blocks-hover",
    type: "line",
    source: "blocks",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": ink, "line-width": 2.4 },
  });
  m.addLayer({
    id: "markers",
    type: "circle",
    source: "markers",
    paint: {
      "circle-radius": ["case", ["==", ["get", "focus"], 1], 9, 5.5],
      "circle-color": ["get", "color"],
      "circle-stroke-color": dark ? "#070b13" : "#ffffff",
      "circle-stroke-width": ["case", ["==", ["get", "focus"], 1], 3, 1.5],
    },
  });
  m.addLayer({
    id: "outline-labels",
    type: "symbol",
    source: "labels",
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12.5,
      "text-allow-overlap": false,
    },
    paint: { "text-color": ink, "text-halo-color": dark ? "#070b13" : "#ffffff", "text-halo-width": 1.6 },
  });
}

/* -------------------------------------------------------------- *
 * Small GeoJSON helpers.
 * -------------------------------------------------------------- */

const shapeId = (f: Feature) => String(f.properties.id ?? f.properties.mb ?? "");
const fc = (features: unknown[]) => ({ type: "FeatureCollection", features }) as GeoJSON.FeatureCollection;
const point = (c: [number, number], properties: Record<string, unknown>) => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: c },
});

function polygons(f: Feature): number[][][][] {
  const g = f.geometry;
  if (!g) return [];
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

function bbox(blocks: Feature[], outlines: Outline[], markers: Marker[]): [number, number, number, number] | null {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity; // prettier-ignore
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const f of [...blocks, ...outlines.map((o) => o.feature)])
    for (const poly of polygons(f)) for (const [x, y] of poly[0] ?? []) grow(x, y);
  for (const m of markers) grow(m.lng, m.lat);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/** Label point: the middle of the largest ring's bounding box. */
function labelPoint(f: Feature): [number, number] | null {
  let best: number[][] = [];
  for (const poly of polygons(f)) if (poly[0] && poly[0].length > best.length) best = poly[0];
  if (!best.length) return null;
  const xs = best.map((p) => p[0]);
  const ys = best.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** n-1 upper bounds splitting the values into n equal-count classes. */
function quantileBreaks(values: number[], n: number): number[] {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return [];
  const out: number[] = [];
  for (let i = 1; i < n; i++) out.push(v[Math.min(v.length - 1, Math.floor((i / n) * v.length))]);
  return out;
}
