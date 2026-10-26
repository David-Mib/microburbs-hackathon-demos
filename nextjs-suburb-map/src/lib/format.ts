/** Number and date formatting, Australian style. Every helper returns "–" for missing values. */

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

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
  if (typeof iso !== "string") return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
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
