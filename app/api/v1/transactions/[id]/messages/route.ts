import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { transactionMessageSchema } from "@/lib/validation";
import { sniffImageType } from "@/lib/image";
import { throttle } from "@/lib/throttle";
import { hasBlockBetween } from "@/lib/blocks";

function validateMessageImage(image: string | null | undefined): string | null {
  if (!image) return null;
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) throw new ApiError("VALIDATION_ERROR", { message: "圖片格式不支援，請使用 PNG、JPG、GIF 或 WebP" });

  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > 450 * 1024) {
    throw new ApiError("VALIDATION_ERROR", { message: "圖片太大，請換一張或截圖裁小一點" });
  }
  if (!sniffImageType(bytes)) {
    throw new ApiError("VALIDATION_ERROR", { message: "圖片格式不支援，請使用 PNG、JPG、GIF 或 WebP" });
  }
  return image;
}

// Coordination chat for a transaction (mainly exchanges). PRD §6.5.
export const POST = route(async (req, ctx) => {
  throttle(req, "transaction-message", 60, 10 * 60_000);
  const { id } = await ctx.params;
  const user = await requireUser();
  const body = await readBody(req, transactionMessageSchema);
  const message = body.message.trim();
  const imageUrl = validateMessageImage(body.image);

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.ownerId !== user.id && t.claimantId !== user.id) throw new ApiError("FORBIDDEN");
  if (await hasBlockBetween(prisma, t.ownerId, t.claimantId)) throw new ApiError("FORBIDDEN");

  const msg = await prisma.transactionMessage.create({
    data: { transactionId: id, senderId: user.id, message, imageUrl },
  });

  const other = user.id === t.ownerId ? t.claimantId : t.ownerId;
  const preview = message ? message.slice(0, 40) : "傳送了一張圖片";
  await notify(prisma, {
    userId: other,
    type: "TRANSACTION_MESSAGE",
    title: "新的交換訊息",
    body: `${user.displayName}：${preview}`,
    referenceType: "transaction",
    referenceId: id,
  });

  return jsonOk({ id: msg.id, image_url: msg.imageUrl, created_at: msg.createdAt }, 201);
});
