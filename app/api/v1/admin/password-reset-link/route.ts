import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta, publicOrigin } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { generateToken, hashToken } from "@/lib/crypto";
import { adminResetLinkSchema } from "@/lib/validation";

export const runtime = "nodejs";

const TTL_HOURS = 24;

// Admin-assisted "forgot password": generate a ONE-TIME reset link for an
// email-login user. The admin never sees or sets the password — the raw token
// lives only in the returned link (only its hash is stored); the user sets their
// own new password at /reset-password. Admin-only + audited.
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { email } = await readBody(req, adminResetLinkSchema);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, displayName: true, loginProvider: true },
  });
  if (!user) throw new ApiError("NOT_FOUND", { message: "找不到這個 Email 的帳號。" });
  if (user.loginProvider !== "EMAIL") {
    throw new ApiError("VALIDATION_ERROR", {
      message: `這個帳號是用 ${user.loginProvider} 登入的，沒有密碼可重設，請他直接用該方式登入。`,
    });
  }

  // Keep at most one live link per user — retire any earlier unused ones.
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
      createdById: admin.id,
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.user.reset_link",
    targetType: "user",
    targetId: user.id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({
    reset_url: `${publicOrigin(req)}/reset-password?token=${token}`,
    expires_hours: TTL_HOURS,
    user: { display_name: user.displayName, email: user.email },
  });
});
