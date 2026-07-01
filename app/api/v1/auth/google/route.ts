import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { route, publicOrigin } from "@/lib/api";
import { googleConfigured, googleAuthUrl } from "@/lib/google";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  const origin = publicOrigin(req);
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`);
  }
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  const redirectUri = `${origin}/api/v1/auth/google/callback`;
  return NextResponse.redirect(googleAuthUrl(state, redirectUri));
});
