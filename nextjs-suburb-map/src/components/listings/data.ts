import { propertyType, validDate } from "@/lib/format";
import { shortName } from "@/lib/api";

/**
 * The three listing feeds and one compact shape for all of them, so the
 * browser only receives the fields the cards render.
 *
 *   buy   GET /v1/suburbs/{name}/listings/for-sale
 *   rent  GET /v1/suburbs/{name}/listings/for-rent
 *   sold  GET /v1/suburbs/{name}/sales/recent
 */
export type Mode = "buy" | "rent" | "sold";

export const MODES: Record<Mode, { label: string; tail: string; noun: string }> = {
  buy: { label: "Buy", tail: "listings/for-sale", noun: "for sale" },
  rent: { label: "Rent", tail: "listings/for-rent", noun: "for rent" },
  sold: { label: "Sold", tail: "sales/recent", noun: "sold" },
};

export const isMode = (s: unknown): s is Mode => s === "buy" || s === "rent" || s === "sold";

export type Listing = {
  id: string;
  address: string;
  /** Short suburb name, e.g. "Glebe". */
  suburb: string;
  /** Exact API suburb name, e.g. "Glebe (NSW)". */
  sal: string;
  lat: number | null;
  lng: number | null;
  /** Asking price (buy), weekly rent (rent) or sold price (sold). */
  price: number | null;
  beds: number | null;
  baths: number | null;
  cars: number | null;
  land: number | null;
  building: number | null;
  type: string;
  /** Listed date, or sold date for sales. */
  date: string | null;
  offMarket: boolean;
  description?: string;
};

/* The API's rows, as far as we read them. */
type ListingRow = {
  gnaf_pid: string;
  address?: { street?: string; sal?: string };
  attributes?: {
    bedrooms?: number;
    bathrooms?: number;
    garage_spaces?: number;
    land_size?: unknown;
    building_size?: unknown;
    description?: string;
  };
  coordinates?: { latitude?: number; longitude?: number };
  listing_date?: string;
  price?: number;
  off_market?: boolean;
  property_type?: string;
};
type SaleRow = {
  gnaf_pid: string;
  address?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  land_size?: unknown;
  sold_price?: number;
  sold_date?: string;
  lat?: number;
  lng?: number;
};
export type FeedBody = { total?: number; results?: (ListingRow | SaleRow)[] };

/** "2026-10-23" stays; "NaT", "", null → null. */
const isoDate = validDate;

/** One clean label per raw type (see propertyType in lib/format.ts). */
export const typeLabel = (t: unknown): string => propertyType(t) ?? "Property";

/** Agent copy arrives with HTML line breaks and entities; make it plain text. */
export function plainText(s: string): string {
  return s
    .replace(/<br\s*\/?>?/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&rsquo;/g, "\u2019")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "94.0", "107 m²", "89m²" → number; "None None", "nan", null → null. */
export function parseArea(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = v.match(/\d+(\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** One feed response → compact listings. */
export function fromFeed(mode: Mode, sal: string, body: FeedBody | null): { total: number; listings: Listing[] } {
  const rows = body?.results ?? [];
  const listings = rows.map((r): Listing => {
    if (mode === "sold") {
      const s = r as SaleRow;
      return {
        id: s.gnaf_pid,
        address: s.address ?? "",
        suburb: shortName(sal),
        sal,
        lat: num(s.lat),
        lng: num(s.lng),
        price: num(s.sold_price),
        beds: num(s.bedrooms),
        baths: num(s.bathrooms),
        cars: null,
        land: parseArea(s.land_size),
        building: null,
        type: typeLabel(s.property_type),
        date: isoDate(s.sold_date),
        offMarket: false,
      };
    }
    const l = r as ListingRow;
    const a = l.attributes ?? {};
    return {
      id: l.gnaf_pid,
      address: l.address?.street ?? "",
      suburb: shortName(l.address?.sal ?? sal),
      sal,
      lat: num(l.coordinates?.latitude),
      lng: num(l.coordinates?.longitude),
      price: num(l.price),
      beds: num(a.bedrooms),
      baths: num(a.bathrooms),
      cars: num(a.garage_spaces),
      land: parseArea(a.land_size),
      building: parseArea(a.building_size),
      type: typeLabel(l.property_type),
      date: isoDate(l.listing_date),
      offMarket: !!l.off_market,
      ...(a.description ? { description: plainText(a.description) } : {}),
    };
  });
  return { total: num(body?.total) ?? listings.length, listings };
}

/** The headline price, the way portals print it. */
export function priceLabel(mode: Mode, price: number | null): string {
  if (price == null) return mode === "rent" ? "Price on request" : mode === "sold" ? "Price withheld" : "Contact agent";
  const full = `$${Math.round(price).toLocaleString("en-AU")}`;
  return mode === "rent" ? `${full} per week` : full;
}

export function shortDate(iso: string | null | undefined, withYear = true): string {
  if (!validDate(iso)) return "";
  const d = new Date(iso as string);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/** "UNIT 19, 5-13 HUTCHINSON STREET" → "Unit 19, 5-13 Hutchinson Street" */
export const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

export function listingHref(l: Pick<Listing, "id" | "sal">, mode: Mode) {
  return `/listings/${encodeURIComponent(l.id)}?suburb=${encodeURIComponent(l.sal)}&mode=${mode}`;
}
