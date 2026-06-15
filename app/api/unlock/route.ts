import { NextResponse } from "next/server";
import { ACCESS_COOKIE, hashToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const real = process.env.ACCESS_PASSWORD;
  if (!real) return NextResponse.json({ ok: true }); // barrière désactivée

  if (typeof password !== "string" || password !== real) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, await hashToken(real), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
  return res;
}
