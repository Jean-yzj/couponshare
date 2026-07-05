import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ reason: z.string().max(300).optional() });

// Admin puts a de-listed coupon back on the shelf — the undo for a wrongful
// takedown (e.g. a coupon pulled by a report that turned out to be malicious).
// Only SUSPENDED coupons can be restored, and only when the OWNER is ACTIVE: a
// suspended owner's coupons are handled by restoring the account, not one by one.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const admin = await requireAdmin();
  const { reason } = await readBody(req, schema);

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { status: true, ownerId: true, title: true, owner: { select: { status: true } } },
  });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.status !== "SUSPENDED") {
    throw new ApiError("INVALID_STATUS_TRANSITION", {
      message: "只有已下架（SUSPENDED）的票券可以重新上架",
    });
  }
  if (coupon.owner?.status !== "ACTIVE") {
    throw new ApiError("INVALID_STATUS_TRANSITION", {
      message: "持有者帳號未啟用，請先在「被停權帳號」解除該帳號的停權，其票券會一併恢復",
    });
  }

  const meta = clientMeta(req);
  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({ where: { id }, data: { status: "AVAILABLE" } });
    await notify(tx, {
      userId: coupon.ownerId,
      type: "REPORT_UPDATED",
      title: "你的票券已重新上架",
      body: `經複核，「${coupon.title}」已重新上架${reason ? `：${reason}` : ""}。感謝你的耐心。`,
      referenceType: "coupon",
      referenceId: id,
    });
    await writeAudit(tx, {
      actorId: admin.id,
      action: "admin.coupon.restore",
      targetType: "coupon",
      targetId: id,
      before: { status: "SUSPENDED" },
      after: { status: "AVAILABLE", reason: reason ?? null },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  return jsonOk({ coupon_id: id, status: "AVAILABLE" });
});
