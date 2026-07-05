import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { route, publicOrigin } from "@/lib/api";
import { googleConfigured, googleAuthUrl } from "@/lib/google";
import { REF_COOKIE } from "@/lib/referral";
import { UTM_COOKIE, normalizeUtm, utmToQuery } from "@/lib/utm";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  const origin = publicOrigin(req);
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref")?.trim() || "";
  const utm = normalizeUtm(Object.fromEntries(url.searchParams));
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`);
  }

  // Run the whole OAuth dance on the one canonical domain registered in the
  // Google Console. Starting from an alternate host (e.g. *.zeabur.app) would
  // send Google a redirect_uri it has never heard of — a hard fail on their
  // side. Bouncing first also puts the state cookie and the session cookie on
  // the domain the user actually finishes on.
  const canonical = process.env.APP_ORIGIN?.replace(/\/+$/, "");
  if (canonical && origin !== canonical) {
    // Carry the invite ref across the host bounce so it survives to the callback.
    const params = new URLSearchParams(utmToQuery(utm));
    if (ref) params.set("ref", ref);
    const qs = params.toString();
    return NextResponse.redirect(
      `${canonical}/api/v1/auth/google${qs ? `?${qs}` : ""}`,
    );
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
  // Stash the invite ref for the callback (only used if a new account is created).
  if (ref) {
    store.set(REF_COOKIE, ref, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
  }
  if (Object.keys(utm).length > 0) {
    store.set(UTM_COOKIE, JSON.stringify(utm), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
  }
  const redirectUri = `${origin}/api/v1/auth/google/callback`;
  return NextResponse.redirect(googleAuthUrl(state, redirectUri));
});
