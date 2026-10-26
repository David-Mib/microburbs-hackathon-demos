/**
 * Paths, types and copyable snippets for the Microburbs Hackathon API.
 * Safe to import anywhere: there is no key in here. The browser calls this
 * app's own /api/mb/... route, which adds the key on the server.
 */

/** Shown in the request inspector until the server tells us the real base. */
export const DEFAULT_API_BASE = "https://api-ht.microburbs.com.au";
export const DOCS_URL = "https://api-ht.microburbs.com.au/docs";

/** The placeholder every snippet uses. Never a real key. */
export const KEY_PLACEHOLDER = "YOUR_TEAM_KEY";

/** The worked example from the API docs. */
export const EXAMPLE_PROPERTY = { gnaf: "GANSW705970502", address: "26 Tudor Street, Surry Hills" };
export const EXAMPLE_SUBURB = "Surry Hills";

/** `/v1/suburbs/{name}/{tail}`, with the name encoded ("Glebe (NSW)" → "Glebe%20(NSW)"). */
export const suburbPath = (name: string, tail: string) => `/v1/suburbs/${encodeURIComponent(name)}/${tail}`;
export const propertyPath = (gnaf: string, tail: string) => `/v1/properties/${encodeURIComponent(gnaf)}/${tail}`;

/** App routes for a suburb and a property. */
export const suburbHref = (name: string) => `/suburbs/${encodeURIComponent(name)}`;
export const propertyHref = (gnaf: string) => `/property/${encodeURIComponent(gnaf)}`;

/** "Glebe (NSW)" → "Glebe", "The Rocks (Sydney - NSW)" → "The Rocks". */
export const shortName = (name: string) => name.replace(/\s*\(.*\)$/, "");

/* -------------------------------------------------------------- *
 * The same request as curl, JavaScript and Python, key as placeholder.
 * -------------------------------------------------------------- */

export function asCurl(url: string) {
  return `curl "${url}" \\\n  -H "Authorization: Bearer ${KEY_PLACEHOLDER}"`;
}

export function asFetch(url: string) {
  return `const res = await fetch("${url}", {
  headers: { Authorization: \`Bearer \${process.env.MICROBURBS_API_KEY}\` },
});
const { data } = await res.json(); // data is null when there is no figure`;
}

export function asPython(url: string) {
  return `import os, requests

res = requests.get(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['MICROBURBS_API_KEY']}"},
)
data = res.json()["data"]  # None when there is no figure`;
}

/* -------------------------------------------------------------- *
 * Response shapes. Only the fields the app reads are typed.
 * -------------------------------------------------------------- */

export type HouseUnit<T> = { house: T | null; unit: T | null };
export type Point = { date: string; value: number };

export type Geometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: Geometry | null;
};

export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

export type SuburbListItem = { suburb: string; state: string };

export type SuburbMatch = {
  area_name: string;
  area_level: string;
  information?: { poa?: string; sa2?: string; lga?: string };
};

export type AddressMatch = {
  id: string;
  name: string;
  display_name: string;
  property_type?: string | null;
};

/** decodeURIComponent that never throws, for showing paths to people. */
export function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
