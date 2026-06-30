import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { assertTransition } from "@/lib/coupon-state";
import { applyScore, SCORE_RULES } from "@/lib/score";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");

  // Claimed / Expired cannot be cancelled (PRD §7). assertTransition enforces it.
  assertTransition(coupon.status, "CANCELLED");

  // Withdrawing a coupon that was already public (AVAILABLE/PENDING) but never
  // given away wastes applicants' time → deduct points. Draft never penalised.
  const wasPublished = coupon.status === "AVAILABLE" || coupon.status === "PENDING";
  const meta = clientMeta(req);

  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (wasPublished) {
      await applyScore(tx, {
        userId: user.id,
        eventType: "COUPON_WITHDRAWN",
        delta: SCORE_RULES.COUPON_WITHDRAWN,
        referenceType: "COUPON",
        referenceId: coupon.id,
        description: "下架已上架但未送出的票券",
      });
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: "coupon.cancel",
      targetType: "coupon",
      targetId: id,
      before: { status: coupon.status },
      after: { status: "CANCELLED", penalty: wasPublished ? SCORE_RULES.COUPON_WITHDRAWN : 0 },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  return jsonOk({
    coupon_id: id,
    status: "CANCELLED",
    penalty: wasPublished ? SCORE_RULES.COUPON_WITHDRAWN : 0,
  });
});
