import type { NextRequest } from "next/server";
import { API_BASE, getUpstream } from "@/lib/server/microburbs";

/**
 * GET /api/mb/v1/... → GET https://api-ht.microburbs.com.au/v1/...
 *
 * The browser never sees the key: it calls this route, and this route calls
 * the API with MICROBURBS_API_KEY added on the server. The response body is
 * passed through untouched, plus a few headers the request inspector shows:
 *
 *   x-upstream-url   the URL we called (no key in it)
 *   x-upstream-ms    how long the API took
 *   x-cache          HIT when this app answered from its own cache
 *   x-request-id     the API's request id, worth quoting if you ask for help
 *
 * Only GET requests under /v1/ are forwarded. If you deploy this app
 * publicly, anyone can use this route with your key, so add your own auth.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/mb/[...path]">) {
  const { path } = await ctx.params;
  if (path[0] !== "v1") {
    return Response.json({ detail: "Only /v1/ paths are forwarded." }, { status: 404 });
  }

  // Next decodes each segment ("Surry%20Hills" → "Surry Hills"); encode them again.
  const upstreamPath = "/" + path.map(encodeURIComponent).join("/") + req.nextUrl.search;
  const r = await getUpstream(upstreamPath);
  const ok = r.status >= 200 && r.status < 300;

  return new Response(r.body, {
    status: r.status,
    headers: {
      "content-type": r.contentType,
      // Successful answers are cached by the CDN in front of the app (Vercel's
      // edge) for an hour, then served stale while one request refreshes them.
      // Errors are never cached.
      "cache-control": ok ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
      "x-upstream-url": `${API_BASE}${upstreamPath}`,
      "x-upstream-ms": String(r.ms),
      "x-cache": r.cached ? "HIT" : "MISS",
      ...(r.requestId ? { "x-request-id": r.requestId } : {}),
    },
  });
}
