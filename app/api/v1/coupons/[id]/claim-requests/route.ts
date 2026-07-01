import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser, requireUser } from "@/lib/auth";
import { assertDailyClaimLimit } from "@/lib/ratelimit";
import { shareGate } from "@/lib/share-gate";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { claimRequestView } from "@/lib/serialize";
import { claimRequestSchema } from "@/lib/validation";

// Apply to claim / exchange a coupon. PRD §7.2.
export const POST = route(async (req, ctx) => {
  const { id: couponId } = await ctx.params;
  const user = await requireActiveUser();
  const body = await readBody(req, claimRequestSchema);

  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId === user.id) throw new ApiError("CANNOT_CLAIM_OWN_COUPON");
  if (coupon.status !== "AVAILABLE") throw new ApiError("COUPON_NOT_AVAILABLE");
  if (coupon.expiryDate && coupon.expiryDate <= new Date()) throw new ApiError("COUPON_EXPIRED");
  if (body.request_type === "EXCHANGE" && !body.exchange_offer_text) {
    throw new ApiError("VALIDATION_ERROR", { message: "交換申請必須填寫交換內容" });
  }

  // Level-restricted coupons block low-tier users (PRD §8.3.7).
  if (coupon.visibilityLevel === "LEVEL_2_ONLY" && user.userLevel === "LEVEL_1") {
    throw new ApiError("FORBIDDEN", { message: "此票券僅限達人以上申請" });
  }
  if (coupon.visibilityLevel === "LEVEL_3_ONLY" && user.userLevel !== "LEVEL_3") {
    throw new ApiError("FORBIDDEN", { message: "此票券僅限傳奇會員申請" });
  }

  // Goodwill gate: brand-new users must share a coupon after a few applications.
  if ((await shareGate(user.id)).mustShareFirst) throw new ApiError("SHARE_FIRST");

  await assertDailyClaimLimit(user);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const cr = await tx.claimRequest.create({
        data: {
          couponId,
          requesterId: user.id,
          requestType: body.request_type,
          message: body.message,
          exchangeOfferText: body.exchange_offer_text ?? null,
          status: "PENDING",
        },
      });
      await tx.coupon.update({
        where: { id: couponId },
        data: { claimRequestCount: { increment: 1 } },
      });
      await notify(tx, {
        userId: coupon.ownerId,
        type: "CLAIM_REQUEST_RECEIVED",
        title: "有人申請你的票券",
        body: `${user.displayName} 申請了「${coupon.title}」`,
        referenceType: "coupon",
        referenceId: couponId,
      });
      return cr;
    });

    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "claim.request",
      targetType: "claim_request",
      targetId: created.id,
      ip: meta.ip,
      ua: meta.ua,
    });

    return jsonOk({ claim_request_id: created.id, status: created.status }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("DUPLICATE_CLAIM_REQUEST");
    }
    throw e;
  }
});

// Owner views the applicant list for their coupon. PRD §7.2.
export const GET = route(async (req, ctx) => {
  const { id: couponId } = await ctx.params;
  const user = await requireUser();

  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");

  const requests = await prisma.claimRequest.findMany({
    where: { couponId },
    include: { requester: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return jsonOk({ data: requests.map(claimRequestView) });
});
