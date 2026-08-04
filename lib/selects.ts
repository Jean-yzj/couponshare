import type { Prisma } from "@prisma/client";

// Shared Prisma SELECT whitelists for list queries. The point: NEVER bulk-load the
// AES barcode / redeem-code blobs (each up to ~6.7MB) or long text into list
// responses. Single-row detail routes may still `include` full rows; lists must
// use these so a wallet/transactions page can't pull hundreds of megabytes.

// Public user fields for cards / owner chips — never secrets.
export const ownerSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  userLevel: true,
  contributionScore: true,
} satisfies Prisma.UserSelect;

// Coupon fields a card needs — deliberately excludes barcodeEncryptedData,
// redeemCodeEncrypted, barcodeImageUrl, barcodeStorageKey and description.
export const couponCardSelect = {
  id: true,
  title: true,
  brand: true,
  category: true,
  redeemKind: true,
  type: true,
  expiryDate: true,
  status: true,
  visibilityLevel: true,
  viewCount: true,
  claimRequestCount: true,
  createdAt: true,
  usedAt: true,
  owner: { select: ownerSelect },
} satisfies Prisma.CouponSelect;

// Minimal coupon reference for a transaction row. barcodeMime / barcodeStorageKey
// / redeemCodeEncrypted are here only so transactionView can say WHICH FORM the
// coupon takes — never the content. barcodeMime is always written alongside
// barcodeEncryptedData (coupons/[id]/barcode/route.ts:52) and storageKey is only
// ever set on rows that already had it, so the pair is a faithful stand-in for
// the multi-MB blob. redeemCodeEncrypted is a short string, safe to load in lists.
//
// Without this the exchange screens had no way to tell an image coupon from a
// redeem-code coupon, so they always opened the barcode viewer — a claimant
// exchanging for a redeem-code coupon got a permanently empty image box.
export const couponMiniSelect = {
  id: true,
  title: true,
  brand: true,
  barcodeMime: true,
  barcodeStorageKey: true,
  redeemCodeEncrypted: true,
} satisfies Prisma.CouponSelect;

// Transaction fields transactionView needs. offerBarcodeMime (a short string,
// always set alongside the offer-barcode blob) stands in for has_offer_barcode,
// so the multi-MB offerBarcodeEncryptedData is never loaded in a list.
// offerRedeemCodeEncrypted is safe to select directly — it's a ≤200-char code,
// and transactionView only exposes whether it exists, never the value.
export const txnSelect = {
  id: true,
  couponId: true,
  transactionType: true,
  status: true,
  ownerCompleted: true,
  claimantCompleted: true,
  ownerReady: true,
  claimantReady: true,
  revealedAt: true,
  offerBarcodeMime: true,
  offerRedeemCodeEncrypted: true,
  disputedAt: true,
  ownerId: true,
  claimantId: true,
  completedAt: true,
  createdAt: true,
  coupon: { select: couponMiniSelect },
  owner: { select: ownerSelect },
  claimant: { select: ownerSelect },
  ratings: { select: { fromUserId: true } },
} satisfies Prisma.TransactionSelect;
