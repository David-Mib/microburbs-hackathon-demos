/** Every demo in the app. Drives the nav, the homepage cards and each page's header. */
export type DemoPage = {
  slug: string;
  name: string;
  /** Short label for the top nav. */
  nav: string;
  /** What someone would build this as. */
  pitch: string;
  /** Endpoint templates the page calls, as the API reference names them. */
  endpoints: string[];
  /** "main" pages sit in the top nav; "more" ones under the More menu. */
  group: "main" | "more";
  isNew?: boolean;
};

export const DEMOS: DemoPage[] = [
  {
    slug: "suburbs",
    nav: "Suburb reports",
    name: "Suburb reports",
    group: "main",
    isNew: true,
    pitch:
      "A one-page report for each of the 29 suburbs: market, prices and rents over time, demographics, crime, schools, lifestyle, risks and development.",
    endpoints: [
      "/suburbs/list",
      "/suburbs/{name}/hero/summary",
      "/suburbs/{name}/market/all",
      "/suburbs/{name}/demographics/all",
      "/suburbs/{name}/ethnicity/all",
      "/suburbs/{name}/crime/summary",
      "/suburbs/{name}/schools/all",
      "/suburbs/{name}/lifestyle/livability",
      "/suburbs/{name}/risks/all",
      "/suburbs/{name}/development/all",
      "/suburbs/{name}/shapes/boundary",
    ],
  },
  {
    slug: "listings",
    nav: "Listings",
    name: "Listings",
    group: "main",
    isNew: true,
    pitch: "Homes for sale, for rent and recently sold across the City of Sydney, with filters, a map view and a page for every listing.",
    endpoints: [
      "/suburbs/list",
      "/suburbs/{name}/listings/for-sale",
      "/suburbs/{name}/listings/for-rent",
      "/suburbs/{name}/sales/recent",
    ],
  },
  {
    slug: "heatmaps",
    nav: "Heat maps",
    name: "Heat maps",
    group: "main",
    isNew: true,
    pitch:
      "The whole city as heat maps: where each ancestry lives, income, house prices, rents, yields, vacancy and livability, block by block.",
    endpoints: [
      "/suburbs/list",
      "/suburbs/{name}/ethnicity/all",
      "/suburbs/{name}/shapes/boundary",
      "/suburbs/{name}/shapes/mesh-blocks",
      "/suburbs/{name}/demographics/income-map",
      "/suburbs/{name}/market/median-price-map",
      "/suburbs/{name}/market/rent-map",
      "/suburbs/{name}/market/yield-map",
      "/suburbs/{name}/lifestyle/livability-map",
    ],
  },
  {
    slug: "crime",
    group: "main",
    nav: "Crime",
    name: "Crime and safety",
    pitch:
      "How a suburb compares with the national rate, which offences drive it, and which blocks of the suburb carry it.",
    endpoints: [
      "/suburbs/{name}/crime/summary",
      "/suburbs/{name}/crime/breakdown",
      "/suburbs/{name}/crime/by-mesh-block",
      "/suburbs/{name}/lifestyle/livability",
      "/suburbs/{name}/shapes/mesh-blocks",
      "/suburbs/{name}/shapes/boundary",
    ],
  },
  {
    slug: "map",
    group: "more",
    nav: "Block map",
    name: "Microburb map",
    pitch: "Price, rent, yield, income, livability and crime for every block of one suburb, on a map you can switch between.",
    endpoints: [
      "/suburbs/{name}/shapes/mesh-blocks",
      "/suburbs/{name}/market/median-price-map",
      "/suburbs/{name}/market/rent-map",
      "/suburbs/{name}/market/yield-map",
      "/suburbs/{name}/demographics/income-map",
      "/suburbs/{name}/lifestyle/livability-map",
      "/suburbs/{name}/crime/by-mesh-block",
      "/suburbs/{name}/shapes/boundary",
    ],
  },
  {
    slug: "market",
    group: "more",
    nav: "Market",
    name: "Market dashboard",
    pitch: "The full history of prices, rents, yields and vacancy for houses and units, with growth and the forecast range.",
    endpoints: [
      "/suburbs/{name}/market/median-sale-price-series",
      "/suburbs/{name}/market/median-rent-series",
      "/suburbs/{name}/market/yield-pct-series",
      "/suburbs/{name}/market/vacancy-rate-series",
      "/suburbs/{name}/market/price-growth",
      "/suburbs/{name}/forecast/sale",
      "/suburbs/{name}/market/days-on-market",
      "/suburbs/{name}/sales/recent",
    ],
  },
  {
    slug: "property",
    group: "main",
    nav: "Property",
    name: "Property profile",
    pitch:
      "Search any address in the City of Sydney: valuation and range, value over time, its street, sale history, hazards, schools, transport and nearby sales.",
    endpoints: [
      "/geocode/address?address=",
      "/properties/{gnaf_id}/basics/all",
      "/properties/{gnaf_id}/valuation/avm",
      "/properties/{gnaf_id}/valuation/value-series",
      "/properties/{gnaf_id}/history/all",
      "/properties/{gnaf_id}/street/profile",
      "/properties/{gnaf_id}/risks/all",
      "/properties/{gnaf_id}/schools/ranking",
      "/properties/{gnaf_id}/transport/nearby",
      "/properties/{gnaf_id}/comparables/recent-sales-nearby",
      "/properties/{gnaf_id}/profile",
    ],
  },
  {
    slug: "compare",
    group: "more",
    nav: "Compare",
    name: "Suburb comparison",
    pitch: "All 29 City of Sydney suburbs side by side: prices, rents, yields, growth, days on market and crime. Sort by any column.",
    endpoints: ["/suburbs/list", "/suburbs/{name}/market/all", "/suburbs/{name}/crime/summary"],
  },
  {
    slug: "finder",
    group: "more",
    nav: "Finder",
    name: "Suburb finder",
    isNew: true,
    pitch: "Rank the 29 suburbs on any of 46 fields, filter by ranges, and see the ranking on the map.",
    endpoints: [
      "/suburbs/finder/fields",
      "/suburbs/finder/search",
      "/suburbs/finder/count",
      "/suburbs/{name}/shapes/boundary",
    ],
  },
];

export const demoBySlug = (slug: string) => DEMOS.find((d) => d.slug === slug)!;

export const MAIN_NAV = DEMOS.filter((d) => d.group === "main");
export const MORE_NAV = DEMOS.filter((d) => d.group === "more");

/** Other demos built on the same API, from other stacks. */
export const MORE_DEMOS = [
  {
    name: "FastAPI property report",
    pitch: "A small Python service that turns any City of Sydney address into a one-page property report.",
    href: "https://microburbs-demo-fastapi.vercel.app",
    cta: "Open the live demo",
  },
  {
    name: "Python quickstart",
    pitch: "Your first calls from Python: find a suburb, find an address, chart a price series. Code on GitHub.",
    href: "https://github.com/David-Mib/microburbs-hackathon-demos/tree/main/python-quickstart",
    cta: "View on GitHub",
  },
];
