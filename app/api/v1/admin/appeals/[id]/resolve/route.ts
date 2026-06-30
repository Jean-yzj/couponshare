import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { adminResolveSchema } from "@/lib/validation";

export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { decision, note } = await readBody(req, adminResolveSchema);

  const appeal = await prisma.appeal.findUnique({ where: { id } });
  if (!appeal) throw new ApiError("NOT_FOUND");
  if (appeal.status !== "PENDING") throw new ApiError("VALIDATION_ERROR", { message: "此申訴已處理" });

  const accept = decision === "ACCEPT";
  const meta = clientMeta(req);

  await prisma.$transaction(async (tx) => {
    await tx.appeal.update({
      where: { id },
      data: {
        status: accept ? "ACCEPTED" : "REJECTED",
        adminNote: note ?? null,
        resolvedAt: new Date(),
      },
    });

    if (accept) {
      // Restore the account, re-list its still-valid coupons, dismiss the reports.
      await tx.user.update({ where: { id: appeal.userId }, data: { status: "ACTIVE" } });
      await tx.coupon.updateMany({
        where: { ownerId: appeal.userId, status: "SUSPENDED", expiryDate: { gt: new Date() } },
        data: { status: "AVAILABLE" },
      });
      await tx.report.updateMany({
        where: { reportedUserId: appeal.userId, status: { in: ["PENDING", "REVIEWING"] } },
        data: { status: "REJECTED", resolvedAt: new Date() },
      });
    }

    await notify(tx, {
      userId: appeal.userId,
      type: "APPEAL_UPDATED",
      title: accept ? "申訴通過，帳號已恢復" : "申訴未通過",
      body: accept
        ? "你的帳號已恢復正常，歡迎繼續分享票券。"
        : note || "經複核後，維持原處分。如有疑問可再次申訴。",
      referenceType: "appeal",
      referenceId: id,
    });

    await writeAudit(tx, {
      actorId: admin.id,
      action: accept ? "appeal.accept" : "appeal.reject",
      targetType: "appeal",
      targetId: id,
      after: { decision, userId: appeal.userId },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  return jsonOk({ id, status: accept ? "ACCEPTED" : "REJECTED" });
});
