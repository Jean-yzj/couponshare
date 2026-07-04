import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth";
import { decryptBarcode } from "@/lib/crypto";
import { verifyBarcodeToken } from "@/lib/barcode-token";

export const runtime = "nodejs";

// Streams the decrypted offer barcode — valid signed token OR session/Bearer auth,
// with re-validated authority (owner only after reveal; claimant = uploader anytime).
// Never cached.
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

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t || !t.offerBarcodeEncryptedData) throw new ApiError("BARCODE_NOT_READY");

  const isClaimant = t.claimantId === uid;
  const isOwner = t.ownerId === uid;
  if (!isClaimant && !isOwner) throw new ApiError("BARCODE_ACCESS_DENIED");
  if (isOwner && !t.revealedAt) throw new ApiError("BARCODE_ACCESS_DENIED");

  const bytes = decryptBarcode(t.offerBarcodeEncryptedData);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": t.offerBarcodeMime || "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Disposition": "inline",
    },
  });
});
