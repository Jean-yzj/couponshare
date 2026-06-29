import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { decryptBarcode } from "@/lib/crypto";
import { verifyBarcodeToken } from "@/lib/barcode-token";

export const runtime = "nodejs";

// Streams the decrypted barcode image — only with a valid short-lived signed
// token AND re-validated owner/claimant authority. Never cached. PRD §8.1.
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") || "";

  const payload = verifyBarcodeToken(token);
  if (!payload || payload.cid !== id) throw new ApiError("BARCODE_ACCESS_DENIED");

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon || !coupon.barcodeEncryptedData) throw new ApiError("BARCODE_NOT_READY");

  const isOwner = coupon.ownerId === payload.uid;
  const isClaimant = coupon.claimantId === payload.uid && coupon.status === "CLAIMED";
  if (!isOwner && !isClaimant) throw new ApiError("BARCODE_ACCESS_DENIED");

  const bytes = decryptBarcode(coupon.barcodeEncryptedData);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": coupon.barcodeMime || "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Disposition": "inline",
    },
  });
});
