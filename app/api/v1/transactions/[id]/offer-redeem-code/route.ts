import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser, requireUser } from "@/lib/auth";
import { encryptBarcode, decryptBarcode } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { throttle } from "@/lib/throttle";
import { offerRedeemCodeSchema } from "@/lib/validation";

export const runtime = "nodejs";

// The text-code counterpart of offer-barcode. Added 2026-08-04: the exchange
// escrow only ever accepted an image, so a claimant whose coupon was a redeem
// code had nothing to submit — ready/route.ts then refused their commit and the
// pair deadlocked, neither side able to reveal. Production had 3 such stuck
// transactions and zero successful redeem-code exchanges, ever.
//
// Storage mirrors Coupon.redeemCodeEncrypted exactly: encryptBarcode() over the
// UTF-8 bytes (despite the name it is AES-GCM over arbitrary bytes, not
// image-specific).
export const POST = route(async (req, ctx) => {
  throttle(req, "offer-redeem-code", 30, 10 * 60_000);
  const { id } = await ctx.params;
  const user = await requireActiveUser();
  const body = await readBody(req, offerRedeemCodeSchema);

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.claimantId !== user.id) throw new ApiError("FORBIDDEN");
  if (t.transactionType !== "EXCHANGE") {
    throw new ApiError("VALIDATION_ERROR", { message: "只有交換需要提供兌換碼" });
  }
  if (t.revealedAt) throw new ApiError("VALIDATION_ERROR", { message: "已亮碼，無法更換兌換碼" });

  await prisma.transaction.update({
    where: { id },
    data: {
      offerRedeemCodeEncrypted: encryptBarcode(Buffer.from(body.redeem_code, "utf8")),
      // The two forms are mutually exclusive: submitting a code clears any
      // previously uploaded image so the owner never sees a stale mismatch.
      offerBarcodeEncryptedData: null,
      offerBarcodeMime: null,
      // Changing what you're offering re-opens your commit, same as
      // offer-barcode does — the other side agreed to what they last saw.
      claimantReady: false,
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "exchange.offer_redeem_code.submit",
    targetType: "transaction",
    targetId: id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ transaction_id: id, upload_status: "SUCCESS" });
});

// Authorization mirrors offer-barcode's GET: the claimant (who submitted it) may
// review their own at any time; the owner only after the simultaneous reveal.
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (!t.offerRedeemCodeEncrypted) throw new ApiError("BARCODE_NOT_READY");
  const isClaimant = t.claimantId === user.id;
  const isOwner = t.ownerId === user.id;
  if (!isClaimant && !isOwner) throw new ApiError("BARCODE_ACCESS_DENIED");
  if (isOwner && !t.revealedAt) throw new ApiError("BARCODE_ACCESS_DENIED");

  const code = decryptBarcode(t.offerRedeemCodeEncrypted).toString("utf8");
  return NextResponse.json(
    { code },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
});
