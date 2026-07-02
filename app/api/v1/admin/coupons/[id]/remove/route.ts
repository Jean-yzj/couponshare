import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ reason: z.string().max(300).optional() });

// Admin pulls a listing off the platform (terms §5 — infringement, fraud, or
// quality violations like unstated discount amounts). Uses SUSPENDED, the same
// reversible state the report flow uses, so a wrong call can be undone; the
// owner is notified with the reason.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const admin = await requireAdmin();
  const { reason } = await readBody(req, schema);

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (!["AVAILABLE", "PENDING", "REPORTED", "DRAFT"].includes(coupon.status)) {
    throw new ApiError("INVALID_STATUS_TRANSITION", {
      message: "此票券目前的狀態無法下架（已送出、已過期或已下架）",
    });
  }

  const meta = clientMeta(req);
  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({ where: { id }, data: { status: "SUSPENDED" } });
    await notify(tx, {
      userId: coupon.ownerId,
      type: "REPORT_UPDATED",
      title: "你的票券已被平台下架",
      body: `「${coupon.title}」因不符合平台規範已被下架${reason ? `：${reason}` : "（如未載明折扣金額、內容不夠具體或附有額外條件）"}。如有疑問請聯繫客服。`,
      referenceType: "coupon",
      referenceId: id,
    });
    await writeAudit(tx, {
      actorId: admin.id,
      action: "admin.coupon.suspend",
      targetType: "coupon",
      targetId: id,
      before: { status: coupon.status },
      after: { status: "SUSPENDED", reason: reason ?? null },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  return jsonOk({ coupon_id: id, status: "SUSPENDED" });
});
