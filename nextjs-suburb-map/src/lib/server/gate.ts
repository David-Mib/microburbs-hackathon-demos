/**
 * Password gate. DEMO_GATE=on turns it on, with the password in DEMO_PASSWORD;
 * off or unset leaves the site open, so a local copy runs as before. On with no
 * password lets nobody in.
 */
export const GATE_ON = (process.env.DEMO_GATE ?? "off").trim().toLowerCase() === "on";
export const GATE_COOKIE = "demo_gate";

/** What the cookie holds once someone has entered the password. */
export async function gateToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`demo-gate:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isUnlocked(cookie: string | undefined): Promise<boolean> {
  const password = process.env.DEMO_PASSWORD;
  return Boolean(password && cookie && cookie === (await gateToken(password)));
}

/** Only send people back to a page on this site. */
export function safeNext(target: string | null | undefined): string {
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/";
}
