import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { throttle } from "@/lib/throttle";

// Exchange escrow commit. Each side presses this once their own barcode is in
// place; when BOTH have committed, the barcodes are revealed simultaneously.
export const POST = route(async (req, ctx) => {
  throttle(req, "txn-ready", 60, 10 * 60_000);
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

    // You can only commit once YOUR side's coupon content exists — in either
    // form. Checking only the image form used to deadlock every redeem-code
    // exchange: the code holder had nothing to "upload", so they could never
    // press ready and the barcodes were never revealed to either party.
    if (isOwner && !t.coupon.barcodeEncryptedData && !t.coupon.barcodeStorageKey && !t.coupon.redeemCodeEncrypted) {
      throw new ApiError("BARCODE_NOT_READY");
    }
    if (isClaimant && !t.offerBarcodeEncryptedData && !t.offerRedeemCodeEncrypted) {
      throw new ApiError("VALIDATION_ERROR", { message: "請先提供你要交換的條碼或兌換碼" });
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
