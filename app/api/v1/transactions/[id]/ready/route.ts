import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// Exchange escrow commit. Each side presses this once their own barcode is in
// place; when BOTH have committed, the barcodes are revealed simultaneously.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();

  const result = await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({ where: { id }, include: { coupon: true } });
    if (!t) throw new ApiError("NOT_FOUND");
    const isOwner = t.ownerId === user.id;
    const isClaimant = t.claimantId === user.id;
    if (!isOwner && !isClaimant) throw new ApiError("FORBIDDEN");
    if (t.transactionType !== "EXCHANGE") {
      throw new ApiError("VALIDATION_ERROR", { message: "只有交換需要確認亮碼" });
    }
    if (t.status !== "CREATED") throw new ApiError("VALIDATION_ERROR", { message: "此交易已結束" });

    // You can only commit once YOUR side's barcode exists.
    if (isOwner && !t.coupon.barcodeEncryptedData) throw new ApiError("BARCODE_NOT_READY");
    if (isClaimant && !t.offerBarcodeEncryptedData) {
      throw new ApiError("VALIDATION_ERROR", { message: "請先上傳你要交換的條碼" });
    }

    const updated = await tx.transaction.update({
      where: { id },
      data: isOwner ? { ownerReady: true } : { claimantReady: true },
    });

    let revealed = !!updated.revealedAt;
    if (!revealed && updated.ownerReady && updated.claimantReady) {
      await tx.transaction.update({ where: { id }, data: { revealedAt: new Date() } });
      revealed = true;
      for (const uid of [t.ownerId, t.claimantId]) {
        await notify(tx, {
          userId: uid,
          type: "TRANSACTION_MESSAGE",
          title: "雙方已確認，條碼已亮出",
          body: "你們現在可以查看彼此的條碼完成交換了",
          referenceType: "transaction",
          referenceId: id,
        });
      }
    }
    return { revealed, owner_ready: updated.ownerReady, claimant_ready: updated.claimantReady };
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "transaction.ready",
    targetType: "transaction",
    targetId: id,
    after: result,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ transaction_id: id, ...result });
});
