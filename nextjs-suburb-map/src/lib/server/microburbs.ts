import "server-only";
import { unstable_cache } from "next/cache";

/**
 * The one place this app talks to the Microburbs Hackathon API.
 *
 * Runs on the server only (the `server-only` import makes the build fail if a
 * client component ever imports it), so the key in MICROBURBS_API_KEY never
 * reaches the browser. Three small courtesies to the API live here too:
 *
 *  - caching, because most answers change at most daily: an in-memory cache,
 *    plus Next's data cache (`unstable_cache`), which on Vercel is shared by
 *    every server instance;
 *  - a pace limit, because each key gets about 10 requests a second;
 *  - a retry when the API says 429 anyway, honouring Retry-After.
 *
 * Server components call `api(path)` (below) and render with the data. The
 * browser calls the /api/mb route, which uses `getUpstream`.
 */

export const API_BASE = (process.env.MICROBURBS_API_BASE || "https://api-ht.microburbs.com.au").replace(/\/+$/, "");

export type UpstreamResult = {
  status: number;
  body: string;
  contentType: string;
  requestId: string | null;
  /** Time the API took, in ms. For a cache hit, the time of the original call. */
  ms: number;
  cached: boolean;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // one hour
export const REVALIDATE_SECONDS = 60 * 60;
const MAX_CACHE_ENTRIES = 2000;
const REQUESTS_PER_SECOND = 8; // stay under the ~10/s per-key limit
const MAX_RETRIES = 3;

type Entry = { at: number; result: Omit<UpstreamResult, "cached"> };

// Kept on globalThis so the cache and the pacer survive hot reloads in `next dev`.
const state = ((globalThis as { __microburbs?: { cache: Map<string, Entry>; inflight: Map<string, Promise<Omit<UpstreamResult, "cached">>>; nextSlot: number } }).__microburbs ??= {
  cache: new Map(),
  inflight: new Map(),
  nextSlot: 0,
});

/** Waits for the next free slot so we never send more than REQUESTS_PER_SECOND. */
async function paced() {
  const now = Date.now();
  const slot = Math.max(now, state.nextSlot);
  state.nextSlot = slot + 1000 / REQUESTS_PER_SECOND;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

/**
 * GET `pathAndQuery` (e.g. "/v1/suburbs/Surry%20Hills/market/all") from the API.
 * Successful (2xx) answers are cached; errors are not.
 */
export async function getUpstream(pathAndQuery: string): Promise<UpstreamResult> {
  const hit = state.cache.get(pathAndQuery);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.result, cached: true };

  // Two browser tabs asking for the same thing share one upstream call.
  let pending = state.inflight.get(pathAndQuery);
  if (!pending) {
    pending = sharedCached(pathAndQuery).finally(() => state.inflight.delete(pathAndQuery));
    state.inflight.set(pathAndQuery, pending);
  }
  const result = await pending;

  if (result.status >= 200 && result.status < 300) {
    if (state.cache.size >= MAX_CACHE_ENTRIES) {
      // Drop the oldest entry (Maps iterate in insertion order).
      state.cache.delete(state.cache.keys().next().value!);
    }
    state.cache.set(pathAndQuery, { at: Date.now(), result });
  }
  return { ...result, cached: false };
}

/** Thrown inside the shared cache so error answers are never stored there. */
class UpstreamError extends Error {
  constructor(readonly result: Omit<UpstreamResult, "cached">) {
    super(`Upstream answered ${result.status}`);
  }
}

/**
 * Next's data cache, shared by every server instance on Vercel and refreshed
 * hourly. A hit returns without touching the API or waiting for the pacer;
 * only a miss calls fetchWithRetry. Errors are passed through, not cached.
 */
const cachedFetch = unstable_cache(
  async (pathAndQuery: string) => {
    const r = await fetchWithRetry(pathAndQuery);
    if (r.status < 200 || r.status >= 300) throw new UpstreamError(r);
    return r;
  },
  ["microburbs-upstream-v2"],
  { revalidate: REVALIDATE_SECONDS },
);

async function sharedCached(pathAndQuery: string): Promise<Omit<UpstreamResult, "cached">> {
  try {
    return await cachedFetch(pathAndQuery);
  } catch (e) {
    if (e instanceof UpstreamError) return e.result;
    throw e;
  }
}

async function fetchWithRetry(pathAndQuery: string): Promise<Omit<UpstreamResult, "cached">> {
  const key = process.env.MICROBURBS_API_KEY;
  if (!key || key === "YOUR_TEAM_KEY") {
    return jsonError(500, "MICROBURBS_API_KEY is not set. Copy .env.example to .env.local and paste your team key.");
  }

  for (let attempt = 0; ; attempt++) {
    await paced();
    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${pathAndQuery}`, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        cache: "no-store", // cached one level up, in cachedFetch
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      return jsonError(502, "Could not reach the Microburbs API. Check your network and MICROBURBS_API_BASE.");
    }
    const ms = Math.round(performance.now() - t0);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = Number(res.headers.get("retry-after")) || 1;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
      continue;
    }

    const body = await res.text();
    return {
      status: res.status,
      body,
      contentType: res.headers.get("content-type") ?? "application/json",
      requestId: res.headers.get("x-request-id"),
      ms,
    };
  }
}

function jsonError(status: number, detail: string): Omit<UpstreamResult, "cached"> {
  return { status, body: JSON.stringify({ detail }), contentType: "application/json", requestId: null, ms: 0 };
}

/** What the page's request inspector shows for a call made on the server. */
export type ServerCall = {
  path: string;
  url: string;
  status: number;
  ms: number;
  size: number;
  requestId: string | null;
  error?: string;
};

export type ApiResult<T> = {
  data: T | null;
  /** The API's explanation when it answered 200 with `data: null`. */
  message: string | null;
  call: ServerCall;
};

/**
 * For server components: GET a path and unwrap the `{ data }` envelope.
 * Returns the data plus a record of the call for the request inspector.
 *
 *   const [summary, market] = await Promise.all([
 *     api<Summary>(suburbPath(name, "hero/summary")),
 *     api<Market>(suburbPath(name, "market/all")),
 *   ]);
 */
export async function api<T>(pathAndQuery: string): Promise<ApiResult<T>> {
  const r = await getUpstream(pathAndQuery);
  let body: { data?: T | null; message?: string; detail?: unknown } | null = null;
  try {
    body = JSON.parse(r.body);
  } catch {
    /* not JSON */
  }
  const ok = r.status >= 200 && r.status < 300;
  const detail = typeof body?.detail === "string" ? body.detail : undefined;
  return {
    data: ok ? (body?.data ?? null) : null,
    message: ok && body?.data == null ? (body?.message ?? "The API has no figure for this.") : null,
    call: {
      path: pathAndQuery,
      url: `${API_BASE}${pathAndQuery}`,
      status: r.status,
      ms: r.ms,
      size: Buffer.byteLength(r.body),
      requestId: r.requestId,
      ...(ok ? {} : { error: detail ?? `The API answered ${r.status}.` }),
    },
  };
}

/** The data only, for when you don't need the call record. */
export async function getData<T>(pathAndQuery: string): Promise<T | null> {
  return (await api<T>(pathAndQuery)).data;
}
