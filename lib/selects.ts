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

// Minimal coupon reference for a transaction row.
export const couponMiniSelect = {
  id: true,
  title: true,
  brand: true,
} satisfies Prisma.CouponSelect;

// Transaction fields transactionView needs. offerBarcodeMime (a short string,
// always set alongside the offer-barcode blob) stands in for has_offer_barcode,
// so the multi-MB offerBarcodeEncryptedData is never loaded in a list.
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
