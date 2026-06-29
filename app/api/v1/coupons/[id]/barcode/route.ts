import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser, requireUser } from "@/lib/auth";
import { encryptBarcode } from "@/lib/crypto";
import { issueBarcodeToken } from "@/lib/barcode-token";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

// Upload (and encrypt) the barcode / QR image. PRD §7.1 + §16.1.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", { field: "file" });
  if (!file.type.startsWith("image/")) {
    throw new ApiError("VALIDATION_ERROR", { field: "file", message: "僅接受圖片檔" });
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError("VALIDATION_ERROR", { field: "file", message: "圖片不可超過 5MB" });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const encrypted = encryptBarcode(bytes);

  await prisma.coupon.update({
    where: { id },
    data: { barcodeEncryptedData: encrypted, barcodeMime: file.type },
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
