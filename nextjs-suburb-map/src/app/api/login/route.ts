import { NextResponse } from "next/server";
import { GATE_COOKIE, gateToken, safeNext } from "@/lib/server/gate";

export async function POST(req: Request) {
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? "/"));
  const password = process.env.DEMO_PASSWORD;

  if (!password || String(form.get("password") ?? "") !== password) {
    const back = new URL("/login", req.url);
    back.searchParams.set("error", "1");
    back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(GATE_COOKIE, await gateToken(password), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
  return res;
}
