import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { createBearerToken } from "@/lib/session";
import { appleLoginSchema } from "@/lib/validation";
import { verifyAppleIdentityToken } from "@/lib/oauth-jwt";
import { writeAudit } from "@/lib/audit";
import { avatarRef } from "@/lib/serialize";
import { throttle } from "@/lib/throttle";

export const runtime = "nodejs";

function displayNameFromFullName(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 40);
  if (value && typeof value === "object") {
    const name = value as { givenName?: string | null; familyName?: string | null };
    const joined = [name.givenName, name.familyName].filter(Boolean).join(" ").trim();
    if (joined) return joined.slice(0, 40);
  }
  return fallback;
}

export const POST = route(async (req) => {
  throttle(req, "apple-native", 20, 10 * 60_000);
  const body = await readBody(req, appleLoginSchema);

  let identity: Awaited<ReturnType<typeof verifyAppleIdentityToken>>;
  try {
    identity = await verifyAppleIdentityToken(body.identity_token);
  } catch {
    throw new ApiError("UNAUTHORIZED");
  }

  const existingByApple = await prisma.user.findUnique({ where: { appleSub: identity.sub } });
  const existingByEmail = identity.email
    ? await prisma.user.findFirst({ where: { email: { equals: identity.email, mode: "insensitive" } } })
    : null;
  const existing = existingByApple ?? existingByEmail;
  if (existing?.status === "DELETED") throw new ApiError("INVALID_CREDENTIALS");
  // Matching by the stable Apple subject is safe. Matching only by email is not —
  // require Apple to have verified the email before attaching to an existing
  // account, or an unverified token could take one over.
  if (!existingByApple && existingByEmail && !identity.emailVerified) {
    throw new ApiError("UNAUTHORIZED");
  }

  const fallbackName = identity.email ? identity.email.split("@")[0] || "Apple 使用者" : "Apple 使用者";
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          appleSub: identity.sub,
          email: existing.email ?? identity.email,
          lastLoginAt: new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          appleSub: identity.sub,
          email: identity.email,
          displayName: displayNameFromFullName(body.full_name, fallbackName),
          loginProvider: "APPLE",
          lastLoginAt: new Date(),
        },
      });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: existing ? "user.login.apple" : "user.register.apple",
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
