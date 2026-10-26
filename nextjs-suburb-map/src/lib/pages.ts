/** Every demo in the app. Drives the nav and the index page. */
export type DemoPage = {
  slug: string;
  name: string;
  /** Short label for the top nav. */
  nav: string;
  /** What someone would build this as. */
  pitch: string;
  /** Endpoint templates the page calls, as the API reference names them. */
  endpoints: string[];
  isNew?: boolean;
};

export const DEMOS: DemoPage[] = [
  {
    slug: "city",
    nav: "City map",
    name: "City map",
    isNew: true,
    pitch:
      "All 29 suburbs of the City of Sydney on one map, every block coloured by income, rent, price, crime, livability or vacancy.",
    endpoints: [
      "/suburbs/list",
      "/suburbs/{name}/shapes/mesh-blocks",
      "/suburbs/{name}/shapes/boundary",
      "/suburbs/{name}/demographics/income-map",
      "/suburbs/{name}/market/median-price-map",
      "/suburbs/{name}/market/rent-map",
      "/suburbs/{name}/crime/by-mesh-block",
      "/suburbs/{name}/lifestyle/livability-map",
      "/suburbs/{name}/market/vacancy-map",
      "/suburbs/{name}/demographics/tenure",
    ],
  },
  {
    slug: "crime",
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
    nav: "Compare",
    name: "Suburb comparison",
    pitch: "All 29 City of Sydney suburbs side by side: prices, rents, yields, growth, days on market and crime. Sort by any column.",
    endpoints: ["/suburbs/list", "/suburbs/{name}/market/all", "/suburbs/{name}/crime/summary"],
  },
  {
    slug: "search",
    nav: "Search",
    name: "Suburb search",
    pitch: "Type-ahead over suburb names, then a snapshot of the one you pick: who lives there and what it is like.",
    endpoints: [
      "/geocode/suburb?q=",
      "/suburbs/{name}/hero/summary",
      "/suburbs/{name}/lifestyle/narrative",
      "/suburbs/{name}/lifestyle/livability",
      "/suburbs/{name}/lifestyle/summary",
      "/suburbs/{name}/demographics/all",
      "/suburbs/{name}/hero/neighbours",
    ],
  },
  {
    slug: "finder",
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

/**
 * Other demos built on the same API. Placeholder links for now: replace the
 * hrefs with the real URLs once they are published.
 */
export const MORE_DEMOS = [
  {
    name: "Python quickstart notebook",
    pitch: "Your first calls from Python: find a suburb, find an address, chart a price series.",
    href: "#python-quickstart",
  },
  {
    name: "FastAPI property report",
    pitch: "A small FastAPI service that turns a GNAF id into a one-page property report.",
    href: "#fastapi-property-report",
  },
];
