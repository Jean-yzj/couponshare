import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// Admin lifts a suspension (e.g. a wrongful auto-suspend from a report brigade):
// account back to ACTIVE and its delisted coupons back on the shelf. Mirror of the
// suspend action.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const meta = clientMeta(req);

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!target) throw new ApiError("NOT_FOUND");
  if (target.status !== "SUSPENDED") return jsonOk({ id, restored: false, status: target.status });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status: "ACTIVE" } });
    // Put back the listings that the suspension cascade pulled down.
    await tx.coupon.updateMany({
      where: { ownerId: id, status: "SUSPENDED" },
      data: { status: "AVAILABLE" },
    });
    await notify(tx, {
      userId: id,
      type: "REPORT_UPDATED",
      title: "你的帳號已恢復",
      body: "經複核，你的帳號停權已解除，相關票券也已重新上架。感謝你的耐心。",
    });
    await writeAudit(tx, {
      actorId: admin.id,
      action: "user.restore",
      targetType: "user",
      targetId: id,
      after: { status: "ACTIVE" },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  return jsonOk({ id, restored: true });
});
