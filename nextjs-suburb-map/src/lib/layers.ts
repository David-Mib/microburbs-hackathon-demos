import { RAMPS } from "@/components/ChoroplethMap";
import { int, money, perWeek, pctPoints } from "./format";

/**
 * Per-block ("microburb") layers. Each one is a suburb endpoint returning a
 * value per mesh block; the polygons come separately from shapes/mesh-blocks
 * and join on the block code (`mb`).
 */

type Row = { mb: string; street?: string } & Record<string, unknown>;
export type LayerBody = {
  definition?: string;
  /** Most layers: one row per block. */
  microburbs?: Row[];
  /** vacancy-map */
  mbs?: Row[];
  /** crime/by-mesh-block: block code → value */
  mesh_blocks?: Record<string, number>;
  dimensions?: { key: string; label: string; description: string }[];
};

export type Layer = {
  key: string;
  label: string;
  tail: string;
  legend: string;
  ramp: readonly string[];
  format: (n: number) => string;
  /** Pull the block's number out of a row. */
  value: (row: Row, dim: string) => unknown;
  note?: string;
};

export const LAYERS: Layer[] = [
  {
    key: "price",
    label: "House price",
    tail: "market/median-price-map",
    legend: "Median house price",
    ramp: RAMPS.blue,
    format: money,
    value: (r) => r.median_price,
    note: "Houses only, so apartment-only blocks (most of the CBD) have no figure.",
  },
  {
    key: "rent",
    label: "Rent",
    tail: "market/rent-map",
    legend: "Median weekly house rent",
    ramp: RAMPS.violet,
    format: perWeek,
    value: (r) => r.weekly_rent,
    note: "Houses only, so apartment-only blocks have no figure.",
  },
  {
    key: "yield",
    label: "Yield",
    tail: "market/yield-map",
    legend: "Gross rental yield, houses",
    ramp: RAMPS.green,
    format: (n) => pctPoints(n),
    value: (r) => r.gross_yield_pct,
  },
  {
    key: "income",
    label: "Income",
    tail: "demographics/income-map",
    legend: "Median weekly household income",
    ramp: RAMPS.violet,
    format: perWeek,
    value: (r) => r.weekly_income,
  },
  {
    key: "renters",
    label: "Renters",
    tail: "demographics/tenure",
    legend: "Share of households renting",
    ramp: RAMPS.teal,
    format: (n) => pctPoints(n, 0),
    value: (r) => r.renting_pct,
  },
  {
    key: "vacancy",
    label: "Vacancy",
    tail: "market/vacancy-map",
    legend: "Rental vacancy",
    ramp: RAMPS.teal,
    format: (n) => pctPoints(n * 100, 1),
    value: (r) => r.vacancy_pct,
  },
  {
    key: "livability",
    label: "Livability",
    tail: "lifestyle/livability-map",
    legend: "Score out of 100",
    ramp: RAMPS.green,
    format: (n) => `${Math.round(n)} / 100`,
    value: (r, dim) => (r.scores as Record<string, number> | undefined)?.[dim],
  },
  {
    key: "crime",
    label: "Crime",
    tail: "crime/by-mesh-block",
    legend: "Predicted incidents per 100,000 residents a year",
    ramp: RAMPS.heat,
    format: int,
    value: () => null,
  },
];

export const DIMS = ["lifestyle", "convenience", "family", "safety", "tranquility", "affluence", "hip"];

/** Read one layer response into block code → value (and → street name). */
export function readLayer(
  body: LayerBody | null,
  layer: Layer,
  dim: string,
  into = { values: new Map<string, number>(), labels: new Map<string, string>() },
) {
  if (!body) return into;
  for (const [mb, v] of Object.entries(body.mesh_blocks ?? {})) into.values.set(mb, v);
  for (const r of [...(body.microburbs ?? []), ...(body.mbs ?? [])]) {
    const v = layer.value(r, dim);
    if (typeof v === "number" && Number.isFinite(v)) into.values.set(String(r.mb), v);
    if (r.street) into.labels.set(String(r.mb), String(r.street));
  }
  return into;
}
