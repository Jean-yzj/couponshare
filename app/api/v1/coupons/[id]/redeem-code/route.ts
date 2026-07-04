import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth";
import { decryptBarcode } from "@/lib/crypto";

export const runtime = "nodejs";

// Returns the decrypted text redeem code to the owner or the CLAIMED claimant only
// (exchange also requires the escrow reveal). Mirrors barcode/image authorization.
// Never cached — the code is as sensitive as a barcode.
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) throw new ApiError("BARCODE_ACCESS_DENIED");

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon || !coupon.redeemCodeEncrypted) throw new ApiError("BARCODE_NOT_READY");

  const isOwner = coupon.ownerId === user.id;
  const isClaimant = coupon.claimantId === user.id && coupon.status === "CLAIMED";
  if (!isOwner && !isClaimant) throw new ApiError("BARCODE_ACCESS_DENIED");

  // Exchange escrow: claimant access requires the simultaneous reveal.
  if (isClaimant && coupon.type === "EXCHANGE") {
    const txn = await prisma.transaction.findUnique({
      where: { couponId: coupon.id },
      select: { revealedAt: true },
    });
    if (!txn?.revealedAt) throw new ApiError("BARCODE_ACCESS_DENIED");
  }

  const code = decryptBarcode(coupon.redeemCodeEncrypted).toString("utf8");
  return NextResponse.json(
    { code },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
});
