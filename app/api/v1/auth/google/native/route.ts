import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { createBearerToken } from "@/lib/session";
import { nativeGoogleSchema } from "@/lib/validation";
import { verifyGoogleIdToken } from "@/lib/oauth-jwt";
import { writeAudit } from "@/lib/audit";
import { avatarRef } from "@/lib/serialize";
import { throttle } from "@/lib/throttle";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  throttle(req, "google-native", 20, 10 * 60_000);
  const body = await readBody(req, nativeGoogleSchema);

  let profile: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
  try {
    profile = await verifyGoogleIdToken(body.id_token);
  } catch {
    throw new ApiError("UNAUTHORIZED");
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: profile.email, mode: "insensitive" } },
  });
  if (existing?.status === "DELETED") throw new ApiError("INVALID_CREDENTIALS");
  // Never attach to an existing account unless Google has verified this email —
  // otherwise an unverified token could take over someone else's account. (Real
  // Google sign-ins are always verified, so legitimate logins are unaffected.)
  if (existing && !profile.emailVerified) throw new ApiError("UNAUTHORIZED");

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: profile.email,
          lastLoginAt: new Date(),
          avatarUrl: existing.avatarUrl ?? profile.picture,
        },
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
    action: existing ? "user.login.google_native" : "user.register.google_native",
    targetType: "user",
    targetId: user.id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({
    token: createBearerToken(user.id),
    user: {
      id: user.id,
      display_name: user.displayName,
      avatar_url: avatarRef(user),
      email: user.email,
      login_provider: user.loginProvider,
      status: user.status,
    },
  });
});
