import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser, requireUser } from "@/lib/auth";
import { encryptBarcode } from "@/lib/crypto";
import { issueBarcodeToken } from "@/lib/barcode-token";
import { writeAudit } from "@/lib/audit";
import { sniffImageType } from "@/lib/image";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

// Upload (and encrypt) the barcode / QR image. PRD §7.1 + §16.1.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");
  // Once claimed (or ended) the barcode is what the claimant accepted — owners
  // must not be able to swap it out from under them.
  if (!["DRAFT", "AVAILABLE", "PENDING"].includes(coupon.status)) {
    throw new ApiError("INVALID_STATUS_TRANSITION", {
      message: "票券已送出或已結束，無法更換條碼",
    });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", { field: "file" });
  if (file.size > MAX_BYTES) {
    throw new ApiError("VALIDATION_ERROR", { field: "file", message: "圖片不可超過 5MB" });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) {
    throw new ApiError("VALIDATION_ERROR", {
      field: "file",
      message: "僅接受 PNG / JPG / WebP / GIF 圖片",
    });
  }
  const encrypted = encryptBarcode(bytes);

  await prisma.coupon.update({
    where: { id },
    data: { barcodeEncryptedData: encrypted, barcodeMime: mime },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "barcode.upload",
    targetType: "coupon",
    targetId: id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ coupon_id: id, upload_status: "SUCCESS" });
});

// Issue a short-lived signed URL for the barcode image. PRD §7.1 + §8.1.
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (!coupon.barcodeEncryptedData) throw new ApiError("BARCODE_NOT_READY");

  const isOwner = coupon.ownerId === user.id;
  const isClaimant = coupon.claimantId === user.id && coupon.status === "CLAIMED";
  if (!isOwner && !isClaimant) throw new ApiError("BARCODE_ACCESS_DENIED");

  // Exchange: the claimant only sees the owner's barcode AFTER both sides commit
  // (simultaneous reveal) — prevents see-the-code-then-bail.
  if (isClaimant && coupon.type === "EXCHANGE") {
    const txn = await prisma.transaction.findUnique({
      where: { couponId: coupon.id },
      select: { revealedAt: true },
    });
    if (!txn?.revealedAt) throw new ApiError("BARCODE_ACCESS_DENIED");
  }

  const { token, expiresIn } = issueBarcodeToken(id, user.id);

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "barcode.access",
    targetType: "coupon",
    targetId: id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({
    barcode_url: `/api/v1/coupons/${id}/barcode/image?token=${token}`,
    expires_in_seconds: expiresIn,
  });
});
