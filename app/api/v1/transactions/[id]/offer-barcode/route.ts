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

// The claimant uploads the barcode they're offering in an exchange. Stored
// encrypted; hidden from the owner until the simultaneous reveal.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.claimantId !== user.id) throw new ApiError("FORBIDDEN");
  if (t.transactionType !== "EXCHANGE") {
    throw new ApiError("VALIDATION_ERROR", { message: "只有交換需要上傳交換條碼" });
  }
  if (t.revealedAt) throw new ApiError("VALIDATION_ERROR", { message: "已亮碼，無法更換條碼" });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", { field: "file" });
  if (file.size > MAX_BYTES) {
    throw new ApiError("VALIDATION_ERROR", { field: "file", message: "圖片不可超過 5MB" });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) {
    throw new ApiError("VALIDATION_ERROR", { field: "file", message: "僅接受 PNG / JPG / WebP / GIF 圖片" });
  }

  await prisma.transaction.update({
    where: { id },
    data: { offerBarcodeEncryptedData: encryptBarcode(bytes), offerBarcodeMime: mime, claimantReady: false },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "exchange.offer_barcode.upload",
    targetType: "transaction",
    targetId: id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ transaction_id: id, upload_status: "SUCCESS" });
});

// Issue a short-lived signed URL for the offer barcode. The owner can view it
// only after the reveal; the claimant (uploader) may preview their own anytime.
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (!t.offerBarcodeEncryptedData) throw new ApiError("BARCODE_NOT_READY");
  const isClaimant = t.claimantId === user.id;
  const isOwner = t.ownerId === user.id;
  if (!isClaimant && !isOwner) throw new ApiError("BARCODE_ACCESS_DENIED");
  if (isOwner && !t.revealedAt) throw new ApiError("BARCODE_ACCESS_DENIED");

  const { token, expiresIn } = issueBarcodeToken(id, user.id);
  return jsonOk({
    barcode_url: `/api/v1/transactions/${id}/offer-barcode/image?token=${token}`,
    expires_in_seconds: expiresIn,
  });
});
