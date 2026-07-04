import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { route, clientMeta, publicOrigin } from "@/lib/api";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { exchangeCode, fetchGoogleProfile } from "@/lib/google";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const saved = store.get("g_state")?.value;
  store.delete("g_state");

  if (!code || !state || !saved || state !== saved) {
    // Most common cause here: the g_state cookie didn't come back on the
    // cross-site redirect from Google (SameSite / third-party-cookie behaviour,
    // esp. in-app browsers). Distinguish it so we're not guessing.
    const why = !code ? "no_code" : !saved ? "no_state_cookie" : state !== saved ? "state_mismatch" : "no_state";
    console.error("[google callback] pre-check failed:", why, { hasCode: !!code, hasSaved: !!saved });
    return NextResponse.redirect(`${origin}/login?error=google_failed&stage=${why}`);
  }

  try {
    const redirectUri = `${origin}/api/v1/auth/google/callback`;
    const token = await exchangeCode(code, redirectUri);
    const profile = await fetchGoogleProfile(token);
    if (!profile.email) return NextResponse.redirect(`${origin}/login?error=google_failed`);
    const email = profile.email.trim().toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { email, lastLoginAt: new Date(), avatarUrl: existing.avatarUrl ?? profile.picture },
        })
      : await prisma.user.create({
          data: {
            email,
            displayName: profile.name,
            avatarUrl: profile.picture,
            loginProvider: "GOOGLE",
            lastLoginAt: new Date(),
          },
        });

    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: existing ? "user.login.google" : "user.register.google",
      targetType: "user",
      targetId: user.id,
      ip: meta.ip,
      ua: meta.ua,
    });

    await createSession(user.id);
    return NextResponse.redirect(`${origin}/`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[google callback] exchange/profile failed:", msg);
    const g = /invalid_client/.test(msg)
      ? "invalid_client" // client_id/secret wrong or secret rotated
      : /redirect_uri_mismatch/.test(msg)
        ? "redirect_uri_mismatch" // callback URL not whitelisted in Google Console
        : /invalid_grant/.test(msg)
          ? "invalid_grant" // code expired/reused — usually transient
          : /token_exchange/.test(msg)
            ? "token_exchange"
            : /profile/.test(msg)
              ? "profile_fetch"
              : "unknown";
    // Temporary: carry a truncated error summary so we can pinpoint an `unknown`
    // failure without log access. Secrets never appear in these messages (the
    // client_secret is only ever in the request body sent TO Google, not in any
    // thrown Error). Remove once diagnosed.
    const d = encodeURIComponent(msg.slice(0, 160));
    return NextResponse.redirect(`${origin}/login?error=google_failed&stage=token&g=${g}&d=${d}`);
  }
});
