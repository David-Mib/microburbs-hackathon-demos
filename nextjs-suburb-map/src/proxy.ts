import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_ON, isUnlocked } from "@/lib/server/gate";

export async function proxy(req: NextRequest) {
  if (!GATE_ON) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  if (await isUnlocked(req.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ detail: "Enter the password first." }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login, 303);
}

export const config = {
  // Everything except the build's static files and the icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
