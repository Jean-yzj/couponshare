import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { assertTransition } from "@/lib/coupon-state";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");

  // Claimed / Expired cannot be cancelled (PRD §7). assertTransition enforces it.
  assertTransition(coupon.status, "CANCELLED");

  const updated = await prisma.coupon.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "coupon.cancel",
    targetType: "coupon",
    targetId: id,
    before: { status: coupon.status },
    after: { status: "CANCELLED" },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ coupon_id: id, status: updated.status });
});
