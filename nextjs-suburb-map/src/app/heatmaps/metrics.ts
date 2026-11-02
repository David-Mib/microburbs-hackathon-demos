import { RAMPS } from "@/components/ChoroplethMap";
import { money, pct } from "@/lib/format";
import { LAYERS, type Layer } from "@/lib/layers";

/**
 * Every map on the heat-maps page. Two shapes of data:
 *
 *  - "block" metrics are per mesh block: one layer endpoint per suburb
 *    (e.g. market/median-price-map), joined to shapes/mesh-blocks on `mb`.
 *  - "suburb" metrics are one number per suburb, drawn on its outline
 *    (shapes/boundary): ancestry and birthplace shares from ethnicity/all,
 *    and census medians from area-stats.
 */
export type Family = "people" | "property" | "life";

export const FAMILIES: { key: Family; label: string; blurb: string }[] = [
  { key: "people", label: "People", blurb: "Who lives where" },
  { key: "property", label: "Property", blurb: "Prices, rents and returns" },
  { key: "life", label: "Life", blurb: "Livability and safety" },
];

type Source =
  | { kind: "block"; layer: Layer }
  | { kind: "ethnicity"; dim: "ancestry" | "birthplace" }
  | { kind: "census"; field: string };

export type Metric = {
  key: string;
  family: Family;
  label: string;
  /** One line under the map: what the colour means. */
  blurb: string;
  legend: string;
  ramp: readonly string[];
  format: (n: number) => string;
  source: Source;
};

/** area-stats takes up to five fields per call: one call per suburb covers every census metric. */
export const CENSUS_FIELDS = [
  "Median_age_persons",
  "Average_household_size",
  "Median_mortgage_repay_monthly",
  "Average_num_psns_per_bedroom",
  "Median_tot_prsnl_inc_weekly",
];

const layer = (key: string) => LAYERS.find((l) => l.key === key)!;
const fromLayer = (key: string, family: Family, blurb: string): Metric => {
  const l = layer(key);
  return { key, family, label: l.label, blurb, legend: l.legend, ramp: l.ramp, format: l.format, source: { kind: "block", layer: l } };
};

export const METRICS: Metric[] = [
  {
    key: "ancestry",
    family: "people",
    label: "Ancestry",
    blurb: "Where people of each ancestry live: the share of residents reporting it, suburb by suburb.",
    legend: "Share of residents",
    ramp: RAMPS.magma,
    format: (n) => pct(n, 1),
    source: { kind: "ethnicity", dim: "ancestry" },
  },
  {
    key: "birthplace",
    family: "people",
    label: "Birthplace",
    blurb: "Share of residents born in each country. The API lists each suburb's top ten countries, so a blank suburb means the country is not in its top ten.",
    legend: "Share of residents born there",
    ramp: RAMPS.violet,
    format: (n) => pct(n, 1),
    source: { kind: "ethnicity", dim: "birthplace" },
  },
  fromLayer("income", "people", "Median weekly household income in every block."),
  fromLayer("renters", "people", "Share of households renting their home, block by block."),
  {
    key: "age",
    family: "people",
    label: "Median age",
    blurb: "Median age of residents at the 2021 Census.",
    legend: "Median age (years)",
    ramp: RAMPS.teal,
    format: (n) => `${n.toFixed(0)} yrs`,
    source: { kind: "census", field: "Median_age_persons" },
  },
  {
    key: "household",
    family: "people",
    label: "Household size",
    blurb: "Average people per household at the 2021 Census.",
    legend: "People per household",
    ramp: RAMPS.blue,
    format: (n) => n.toFixed(1),
    source: { kind: "census", field: "Average_household_size" },
  },
  fromLayer("price", "property", "Modelled median house price for every block."),
  fromLayer("rent", "property", "Modelled median weekly house rent for every block."),
  fromLayer("yield", "property", "Gross rental yield: a year's rent over the price, houses."),
  fromLayer("vacancy", "property", "Share of rental homes sitting empty."),
  {
    key: "mortgage",
    family: "property",
    label: "Mortgage",
    blurb: "Median monthly mortgage repayment at the 2021 Census.",
    legend: "Median monthly repayment",
    ramp: RAMPS.heat,
    format: (n) => money(n),
    source: { kind: "census", field: "Median_mortgage_repay_monthly" },
  },
  fromLayer("livability", "life", "Livability scores out of 100, block by block. Pick a dimension."),
  fromLayer("crime", "life", "Predicted incidents per 100,000 residents a year, block by block."),
  {
    key: "crowding",
    family: "life",
    label: "Crowding",
    blurb: "Average people per bedroom at the 2021 Census.",
    legend: "People per bedroom",
    ramp: RAMPS.violet,
    format: (n) => n.toFixed(2),
    source: { kind: "census", field: "Average_num_psns_per_bedroom" },
  },
];

export const metricByKey = (key: string) => METRICS.find((m) => m.key === key) ?? METRICS[0];

