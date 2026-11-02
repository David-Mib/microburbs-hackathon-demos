/** Number and date formatting, Australian style. Every helper returns "–" for missing values. */

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * True for values the API means as "no value". Some fields arrive as pandas
 * nulls written out as text ("NaT", "NaN", "nan", "None", "None None"), so
 * treat those like null: format them as missing and hide the line.
 */
export function isMissing(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "number") return !Number.isFinite(v);
  if (typeof v === "string") return /^\s*(nat|nan|none|null|undefined|none none)?\s*$/i.test(v);
  return false;
}

/** A date string, or null when the API sent a null in any of its forms. */
export const validDate = (v: unknown): string | null =>
  typeof v === "string" && !isMissing(v) && !Number.isNaN(new Date(v).getTime()) ? v : null;

/**
 * The API's raw property types ("Apartmentunitflat", "Apartment / Unit / Flat",
 * "Newapartments", "unit", "House" ...) as one clean label. null when there is
 * no type worth showing.
 */
export function propertyType(t: unknown): string | null {
  if (typeof t !== "string" || isMissing(t)) return null;
  const s = t.toLowerCase();
  if (/studio/.test(s)) return "Studio";
  if (/apartment|unit|flat/.test(s)) return "Unit";
  if (/townhouse/.test(s)) return "Townhouse";
  if (/terrace/.test(s)) return "Terrace";
  if (/semi/.test(s)) return "Semi";
  if (/duplex/.test(s)) return "Duplex";
  if (/villa/.test(s)) return "Villa";
  if (/land|vacant/.test(s)) return "Land";
  if (/house/.test(s)) return "House";
  if (/^other$/.test(s.trim())) return null;
  return t.trim()[0].toUpperCase() + t.trim().slice(1).toLowerCase();
}

export const DASH = "–";

/** $1.46m, $925k, $675 */
export function money(n: unknown): string {
  if (!isNum(n)) return DASH;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}m`;
  if (Math.abs(n) >= 1e4) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n).toLocaleString("en-AU")}`;
}

export const moneyFull = (n: unknown) => (isNum(n) ? `$${Math.round(n).toLocaleString("en-AU")}` : DASH);

/** A fraction: 0.0379 → "3.8%" */
export const pct = (n: unknown, dp = 1) => (isNum(n) ? `${(n * 100).toFixed(dp)}%` : DASH);

/** A fraction with a sign: 0.0379 → "+3.8%" */
export const signedPct = (n: unknown, dp = 1) => (isNum(n) ? `${n > 0 ? "+" : ""}${(n * 100).toFixed(dp)}%` : DASH);

/** Already a percentage: 4.2 → "4.2%" */
export const pctPoints = (n: unknown, dp = 1) => (isNum(n) ? `${n.toFixed(dp)}%` : DASH);

export const int = (n: unknown) => (isNum(n) ? Math.round(n).toLocaleString("en-AU") : DASH);

export const perWeek = (n: unknown) => (isNum(n) ? `$${Math.round(n).toLocaleString("en-AU")}/wk` : DASH);

export function date(iso: unknown): string {
  if (!validDate(iso)) return DASH;
  const d = new Date(iso as string);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function metres(m: unknown): string {
  if (!isNum(m)) return DASH;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** "public_order" → "Public order" */
export const humanise = (s: string) => {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};
