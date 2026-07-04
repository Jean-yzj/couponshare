import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getCurrentUser, requireActiveUser } from "@/lib/auth";
import { couponDetail } from "@/lib/serialize";
import { ratingSummary } from "@/lib/ratings";
import { updateCouponSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { encryptBarcode } from "@/lib/crypto";
import { normalizeBrand } from "@/lib/brands";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();

  const coupon = await prisma.coupon.findUnique({ where: { id }, include: { owner: true } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");

  if (viewer && viewer.id !== coupon.ownerId) {
    await prisma.coupon
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  }

  // Surface the viewer's own claim-request status so the page can show
  // "已送出申請 / 已獲得" instead of the apply button. PRD §7.2.
  let myRequestStatus = null;
  let myRequestId: string | null = null;
  if (viewer && viewer.id !== coupon.ownerId) {
    const cr = await prisma.claimRequest.findUnique({
      where: { couponId_requesterId: { couponId: id, requesterId: viewer.id } },
      select: { id: true, status: true },
    });
    myRequestStatus = cr?.status ?? null;
    myRequestId = cr?.id ?? null;
  }

  const ownerRating = await ratingSummary(prisma, coupon.ownerId);
  return jsonOk({
    ...couponDetail(coupon, viewer, myRequestStatus),
    owner_rating: ownerRating,
    my_request_id: myRequestId,
  });
});

// Owner edits listing info after upload (typos, wrong expiry, etc.). Only while
// the coupon is still theirs to give — once CLAIMED (or ended) the listing is
// frozen as the record of what the claimant accepted. Type/barcode not here:
// type would change application semantics, barcode has its own guarded route.
export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();
  const body = await readBody(req, updateCouponSchema);

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");
  if (!["DRAFT", "AVAILABLE", "PENDING"].includes(coupon.status)) {
    throw new ApiError("INVALID_STATUS_TRANSITION", {
      message: "票券已送出或已結束，無法再編輯",
    });
  }
  if (body.expiry_date && body.expiry_date <= new Date()) {
    throw new ApiError("VALIDATION_ERROR", { message: "到期日必須是未來的時間" });
  }

  const updated = await prisma.coupon.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.brand !== undefined && { brand: normalizeBrand(body.brand) }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.redeem_kind !== undefined && { redeemKind: body.redeem_kind }),
      ...(body.redeem_code !== undefined && {
        redeemCodeEncrypted: body.redeem_code
          ? encryptBarcode(Buffer.from(body.redeem_code, "utf8"))
          : null,
      }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.expiry_date !== undefined && { expiryDate: body.expiry_date }),
      ...(body.exchange_target !== undefined && { exchangeTarget: body.exchange_target }),
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "coupon.update",
    targetType: "coupon",
    targetId: id,
    before: {
      title: coupon.title,
      brand: coupon.brand,
      category: coupon.category,
      expiryDate: coupon.expiryDate,
    },
    after: {
      title: updated.title,
      brand: updated.brand,
      category: updated.category,
      expiryDate: updated.expiryDate,
    },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk(couponDetail(updated, user));
});
