import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { verifyPassword } from "@/lib/crypto";
import { createBearerToken } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";
import { writeAudit } from "@/lib/audit";
import { avatarRef } from "@/lib/serialize";

export const POST = route(async (req) => {
  throttle(req, "auth-token", 10, 5 * 60_000);
  const body = await readBody(req, loginSchema);
  const user = await prisma.user.findFirst({
    where: { email: { equals: body.email, mode: "insensitive" } },
  });
  if (!user) throw new ApiError("INVALID_CREDENTIALS");
  if (user.status === "DELETED") throw new ApiError("INVALID_CREDENTIALS");
  if (!user.passwordHash) throw new ApiError("PASSWORD_LOGIN_UNAVAILABLE");
  if (!verifyPassword(body.password, user.passwordHash)) throw new ApiError("INVALID_CREDENTIALS");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "user.login.token",
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
