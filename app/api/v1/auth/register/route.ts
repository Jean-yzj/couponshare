import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { registerSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";

export const POST = route(async (req) => {
  // Throttle account creation per IP — also makes email-enumeration probing impractical.
  throttle(req, "register", 8, 60 * 60_000);
  const body = await readBody(req, registerSchema);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ApiError("EMAIL_TAKEN");

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: hashPassword(body.password),
      displayName: body.display_name,
      loginProvider: "EMAIL",
      lastLoginAt: new Date(),
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "user.register",
    targetType: "user",
    targetId: user.id,
    ip: meta.ip,
    ua: meta.ua,
  });

  await createSession(user.id);
  return jsonOk({ id: user.id, display_name: user.displayName }, 201);
});
