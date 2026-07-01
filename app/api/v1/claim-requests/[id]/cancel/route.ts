import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// Requester withdraws their own still-pending application. Removing the row frees
// the coupon's request count and lets them apply again later if they change their
// mind. Only PENDING requests can be cancelled (approved = already received). PRD §7.2.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const meta = clientMeta(req);

  const cr = await prisma.claimRequest.findUnique({ where: { id } });
  if (!cr) throw new ApiError("CLAIM_REQUEST_NOT_FOUND");
  if (cr.requesterId !== user.id) throw new ApiError("FORBIDDEN");
  if (cr.status !== "PENDING") {
    throw new ApiError("INVALID_STATUS_TRANSITION", { from: cr.status, to: "CANCELLED" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.claimRequest.delete({ where: { id } });
    await tx.coupon.update({
      where: { id: cr.couponId },
      data: { claimRequestCount: { decrement: 1 } },
    });
  });

  await writeAudit(prisma, {
    actorId: user.id,
    action: "claim.cancel",
    targetType: "claim_request",
    targetId: id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ ok: true });
});
