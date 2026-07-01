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
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
  }

  try {
    const redirectUri = `${origin}/api/v1/auth/google/callback`;
    const token = await exchangeCode(code, redirectUri);
    const profile = await fetchGoogleProfile(token);
    if (!profile.email) return NextResponse.redirect(`${origin}/login?error=google_failed`);

    const existing = await prisma.user.findUnique({ where: { email: profile.email } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { lastLoginAt: new Date(), avatarUrl: existing.avatarUrl ?? profile.picture },
        })
      : await prisma.user.create({
          data: {
            email: profile.email,
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
  } catch {
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
  }
});
