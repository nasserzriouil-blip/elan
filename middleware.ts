import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, hashToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const pw = process.env.ACCESS_PASSWORD;

  // Pas de mot de passe configuré (ex. en local) -> barrière désactivée.
  if (!pw) return NextResponse.next();

  const expected = await hashToken(pw);
  const got = req.cookies.get(ACCESS_COOKIE)?.value;
  if (got === expected) return NextResponse.next();

  // Non authentifié.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Accès refusé" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

// On laisse passer les assets, la page de déverrouillage et son API.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|unlock|api/unlock).*)",
  ],
};
