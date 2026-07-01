import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth";
import { decryptBarcode } from "@/lib/crypto";
import { verifyBarcodeToken } from "@/lib/barcode-token";

export const runtime = "nodejs";

// Streams the decrypted barcode image with re-validated owner/claimant authority.
// Never cached. PRD §8.1. Authorizes via EITHER a short-lived signed token OR the
// session cookie — same-origin <img> requests carry the cookie automatically, so
// the client can point <img src> straight here and skip the "issue signed URL"
// round-trip. That single-hop path is what makes a received ticket appear instantly.
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") || "";

  let uid: string;
  if (token) {
    const payload = verifyBarcodeToken(token);
    if (!payload || payload.cid !== id) throw new ApiError("BARCODE_ACCESS_DENIED");
    uid = payload.uid;
  } else {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("BARCODE_ACCESS_DENIED");
    uid = user.id;
  }

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon || !coupon.barcodeEncryptedData) throw new ApiError("BARCODE_NOT_READY");

  const isOwner = coupon.ownerId === uid;
  const isClaimant = coupon.claimantId === uid && coupon.status === "CLAIMED";
  if (!isOwner && !isClaimant) throw new ApiError("BARCODE_ACCESS_DENIED");

  // Exchange escrow: claimant barcode access requires the simultaneous reveal.
  if (isClaimant && coupon.type === "EXCHANGE") {
    const txn = await prisma.transaction.findUnique({
      where: { couponId: coupon.id },
      select: { revealedAt: true },
    });
    if (!txn?.revealedAt) throw new ApiError("BARCODE_ACCESS_DENIED");
  }

  const bytes = decryptBarcode(coupon.barcodeEncryptedData);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": coupon.barcodeMime || "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Disposition": "inline",
    },
  });
});
