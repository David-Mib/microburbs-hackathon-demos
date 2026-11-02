import "server-only";
import { type HouseUnit, type Point, suburbPath } from "@/lib/api";
import { api } from "@/lib/server/microburbs";

/*
 * Every call a suburb report makes, started together. The order below is the
 * order they leave the server in (the client paces itself to the API's rate
 * limit), so the hero's calls go first and the page can stream the rest.
 */

export type Summary = {
  area_name: string;
  state_abbr: string;
  sa3: string;
  sa4: string;
  postcode: string;
  population: number | null;
  dwellings: number | null;
};

type Dated<T> = T & { as_of?: string };
export type MarketAll = {
  median_sale_price: Dated<HouseUnit<number>> | null;
  median_sale_price_series: HouseUnit<Point[]> | null;
  median_rent: Dated<HouseUnit<number>> | null;
  median_rent_series: HouseUnit<Point[]> | null;
  yield_pct: HouseUnit<number> | null;
  days_on_market: HouseUnit<number> | null;
};
type Growth = Record<"1yr" | "3yr" | "5yr" | "10yr", number | null>;
export type PriceGrowth = HouseUnit<Growth>;
type Range = { low: number; most_likely: number; high: number };
export type Forecast = HouseUnit<Range>;
export type Vacancy = HouseUnit<{ value: number; rank: number; areas: number }>;
export type Stock = { stock_on_market: number | null; house: number | null; unit: number | null };
export type Bedrooms = { bedrooms: { bedrooms: number; house_price: number | null; unit_price: number | null; n_sales: number }[] };
export type Sale = {
  gnaf_pid: string;
  address: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sold_price: number | null;
  sold_date: string;
};
export type Sales = { total: number; results: Sale[] };

export type Demographics = {
  age: { proportion: number; age_bracket: string; gender: string }[];
  income: { proportion: number; income_bracket: string; median_income: number | null }[];
};
export type Ethnicity = {
  ancestry: { proportion: number; ancestry: string }[];
  birthplace: { proportion: number; country: string }[];
};
export type Population = { current_population: number; suburb_series: { year: number; population: number }[] };
export type Unemployment = { unemployment_pct: number | null; national_median_pct: number | null };

export type CrimeSummary = { suburb_median: number; national_median: number; vs_national_pct: number; verdict: string };
export type CrimeBreakdown = {
  breakdown: { type: string; label: string; rate: number; national_median: number; diff_pct: number; verdict: string }[];
};
export type School = {
  id: number;
  name: string;
  school_level_type: string;
  school_sector_type: string;
  naplan_rank: number | null;
  socioeconomic_rank: number | null;
  boys: number | null;
  girls: number | null;
};

export type Livability = {
  scores: { key: string; label: string; value: number | null; level: string }[];
  benchmark?: { region: string; n_suburbs: number; scores: Record<string, number> };
};
export type Narrative = { sentences: Record<string, string> };
export type Pois = {
  total_pois: number;
  poi_categories: { category: string; count: number; top_subtypes: { label: string; count: number }[] }[];
};

export type Risks = {
  bushfire?: { coverage_pct: number | null } | null;
  flood?: { coverage_pct: number | null; risk_band?: string | null } | null;
};
export type Heritage = { heritage_pct: number | null };
export type Slope = { median_slope_deg: number | null; steep_pct: number | null };
export type RiskCounts = { contamination_points_n: number | null; heritage_items_n: number | null; erosion_n: number | null };

export type Da = { description: string; date: string; category: string | null };
export type Density = {
  dwellings_per_km2: number | null;
  people_per_km2: number | null;
  density_level: string | null;
  area_km2: number | null;
};
export type DevProfile = { apartment_pct: number | null; avg_lot_m2: number | null };
export type Supply = { summary: { new_houses: number; new_units: number; total_new: number; pct_units: number } | null };

export type Neighbours = { neighbours: { sal: string; dist_km: number }[] };
export type Similar = { area_name: string; summary: string; keywords: string | null }[];

export function loadReport(name: string) {
  const p = (tail: string) => suburbPath(name, tail);
  // Hero first.
  const summary = api<Summary>(p("hero/summary"));
  const market = api<MarketAll>(p("market/all"));
  const livability = api<Livability>(p("lifestyle/livability"));
  // Market.
  const growth = api<PriceGrowth>(p("market/price-growth"));
  const forecast = api<Forecast>(p("forecast/sale"));
  const vacancy = api<Vacancy>(p("market/vacancy-rate"));
  const stock = api<Stock>(p("market/stock-on-market"));
  const bedrooms = api<Bedrooms>(p("market/bedroom-stats"));
  const sales = api<Sales>(p("sales/recent?limit=8"));
  // Safety.
  const crime = api<CrimeSummary>(p("crime/summary"));
  const crimeBreakdown = api<CrimeBreakdown>(p("crime/breakdown"));
  // Risks.
  const risks = api<Risks>(p("risks/all"));
  const heritage = api<Heritage>(p("risks/heritage-share"));
  const slope = api<Slope>(p("risks/slope"));
  const riskCounts = api<RiskCounts>(p("risks/counts"));
  // Development.
  const das = api<Da[]>(p("development/da-list"));
  const density = api<Density>(p("development/density"));
  const devProfile = api<DevProfile>(p("development/profile"));
  const supply = api<Supply>(p("development/supply"));
  // Lifestyle.
  const narrative = api<Narrative>(p("lifestyle/narrative"));
  const pois = api<Pois>(p("lifestyle/summary"));
  const schools = api<School[]>(p("schools/nearby"));
  // People.
  const demographics = api<Demographics>(p("demographics/all"));
  const ethnicity = api<Ethnicity>(p("ethnicity/all"));
  const population = api<Population>(p("demographics/population-history"));
  const unemployment = api<Unemployment>(p("demographics/unemployment"));
  // Around.
  const neighbours = api<Neighbours>(p("hero/neighbours"));
  const similar = api<Similar>(p("similar"));

  return {
    summary,
    market,
    livability,
    growth,
    forecast,
    vacancy,
    stock,
    bedrooms,
    sales,
    crime,
    crimeBreakdown,
    risks,
    heritage,
    slope,
    riskCounts,
    das,
    density,
    devProfile,
    supply,
    narrative,
    pois,
    schools,
    demographics,
    ethnicity,
    population,
    unemployment,
    neighbours,
    similar,
  };
}

export type Report = ReturnType<typeof loadReport>;
