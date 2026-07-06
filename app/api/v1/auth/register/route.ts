import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { registerSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";
import { resolveReferrer, REFERRAL_BONUS } from "@/lib/referral";
import { grantBonusClaims } from "@/lib/bonus";
import { getFlag, FLAG_REGISTER_PAUSED } from "@/lib/settings";
import { isIpBlocked } from "@/lib/blocked-ip";
import { utmCreateData } from "@/lib/utm";

export const POST = route(async (req) => {
  // Throttle account creation per IP — also makes email-enumeration probing impractical.
  throttle(req, "register", 8, 60 * 60_000);
  // Emergency kill-switch: pause new signups during a mass-registration attack.
  if (await getFlag(FLAG_REGISTER_PAUSED)) {
    throw new ApiError("VALIDATION_ERROR", { message: "目前暫停開放新帳號註冊，請稍後再試。" });
  }
  // Block new accounts from an IP tied to a suspended user (evasion).
  if (await isIpBlocked(clientMeta(req).ip)) {
    throw new ApiError("VALIDATION_ERROR", { message: "此網路目前無法註冊新帳號，如有疑問請聯繫客服。" });
  }
  const body = await readBody(req, registerSchema);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: body.email, mode: "insensitive" } },
  });
  if (existing) throw new ApiError("EMAIL_TAKEN");

  const referredById = await resolveReferrer(body.ref);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: hashPassword(body.password),
      displayName: body.display_name,
      loginProvider: "EMAIL",
      lastLoginAt: new Date(),
      birthYear: body.birth_year ?? undefined,
      ...utmCreateData(body.utm),
      referredById,
    },
  });

  // Referral reward: the inviter gets +2 claim-attempts in their monthly pool.
  if (referredById) await grantBonusClaims(prisma, referredById, REFERRAL_BONUS);

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
