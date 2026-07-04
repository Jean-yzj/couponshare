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
    console.error("[google callback] pre-check failed", { hasCode: !!code, hasSaved: !!saved, match: state === saved });
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
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
    // Log the real cause (token exchange / profile fetch / DB write) — the user
    // just gets a generic retry. Root-caused once here: a schema drift where
    // users.apple_sub / blocks / push_tokens existed in the Prisma client but
    // not in the DB, so every user upsert threw P2022.
    console.error("[google callback] failed:", e);
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
  }
});
