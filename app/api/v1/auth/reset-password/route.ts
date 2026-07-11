import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { hashPassword, hashToken } from "@/lib/crypto";
import { resetPasswordSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";

export const runtime = "nodejs";

// A user sets a new password using a one-time reset token from an admin-issued
// link. The token IS the authorization — no session needed. Single-use + expiry;
// the raw token is never stored (we match on its hash).
export const POST = route(async (req) => {
  throttle(req, "reset-password", 10, 60 * 60_000);
  const { token, password } = await readBody(req, resetPasswordSchema);

  const rec = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!rec || rec.usedAt || rec.expiresAt <= new Date()) {
    throw new ApiError("VALIDATION_ERROR", {
      message: "這條重設連結無效或已過期，請再向管理員索取一條。",
    });
  }

  // Set the new password and burn the token in one atomic step.
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
  ]);

  return jsonOk({ ok: true });
});
