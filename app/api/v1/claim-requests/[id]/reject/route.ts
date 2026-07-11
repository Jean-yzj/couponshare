import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { rejectSchema } from "@/lib/validation";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const body = await readBody(req, rejectSchema);

  const cr = await prisma.claimRequest.findUnique({ where: { id }, include: { coupon: true } });
  if (!cr) throw new ApiError("CLAIM_REQUEST_NOT_FOUND");
  if (cr.coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");
  if (cr.status !== "PENDING") {
    throw new ApiError("INVALID_STATUS_TRANSITION", { from: cr.status, to: "REJECTED" });
  }

  // Un-count the application (matches cancel) so claimRequestCount tracks live
  // applications — otherwise a coupon whose only applicant was rejected keeps a
  // stale count and never qualifies for the zero-interest auto-delist.
  await prisma.$transaction(async (tx) => {
    await tx.claimRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        ownerResponseMessage: body.reason ?? null,
      },
    });
    await tx.coupon.update({
      where: { id: cr.couponId },
      data: { claimRequestCount: { decrement: 1 } },
    });
  });

  await notify(prisma, {
    userId: cr.requesterId,
    type: "CLAIM_REJECTED",
    title: "申請未被接受",
    body: body.reason || `「${cr.coupon.title}」的申請未被接受，謝謝你的參與`,
    referenceType: "coupon",
    referenceId: cr.couponId,
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "claim.reject",
    targetType: "claim_request",
    targetId: id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ claim_request_id: id, status: "REJECTED" });
});
