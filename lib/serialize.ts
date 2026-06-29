import type { Coupon, ClaimRequest, Notification, Rating, Transaction, User } from "@prisma/client";
import { LEVELS } from "./levels";

type OwnerRelation = Pick<
  User,
  "id" | "displayName" | "avatarUrl" | "userLevel" | "contributionScore"
>;

export function publicUser(u: OwnerRelation) {
  return {
    id: u.id,
    display_name: u.displayName,
    avatar_url: u.avatarUrl,
    user_level: u.userLevel,
    level_name: LEVELS[u.userLevel].name,
    contribution_score: u.contributionScore,
  };
}

// Feed card. NEVER includes barcode_* fields (PRD §8.1, AC §17.2).
export function feedCoupon(c: Coupon & { owner?: OwnerRelation | null }) {
  return {
    id: c.id,
    title: c.title,
    brand: c.brand,
    type: c.type,
    expiry_date: c.expiryDate,
    status: c.status,
    visibility_level: c.visibilityLevel,
    view_count: c.viewCount,
    claim_request_count: c.claimRequestCount,
    created_at: c.createdAt,
    owner: c.owner ? publicUser(c.owner) : null,
  };
}

// Detail view. Exposes only `has_barcode` / `can_view_barcode` booleans — never
// the encrypted blob, storage key, or any URL.
export function couponDetail(
  c: Coupon & { owner?: OwnerRelation | null },
  viewer: { id: string } | null,
) {
  const isOwner = !!viewer && c.ownerId === viewer.id;
  const isClaimant = !!viewer && c.claimantId === viewer.id;
  const hasBarcode = !!c.barcodeEncryptedData;
  const canViewBarcode = (isOwner || (isClaimant && c.status === "CLAIMED")) && hasBarcode;
  return {
    id: c.id,
    title: c.title,
    brand: c.brand,
    description: c.description,
    type: c.type,
    exchange_target: c.exchangeTarget,
    expiry_date: c.expiryDate,
    status: c.status,
    unlock_policy: c.unlockPolicy,
    visibility_level: c.visibilityLevel,
    view_count: c.viewCount,
    claim_request_count: c.claimRequestCount,
    report_count: c.reportCount,
    has_barcode: hasBarcode,
    can_view_barcode: canViewBarcode,
    is_owner: isOwner,
    is_claimant: isClaimant,
    claimant_id: c.claimantId,
    claimed_at: c.claimedAt,
    cancelled_at: c.cancelledAt,
    created_at: c.createdAt,
    owner: c.owner ? publicUser(c.owner) : null,
  };
}

export function claimRequestView(
  r: ClaimRequest & { requester?: OwnerRelation | null },
) {
  return {
    id: r.id,
    coupon_id: r.couponId,
    requester: r.requester ? publicUser(r.requester) : null,
    request_type: r.requestType,
    message: r.message,
    exchange_offer_text: r.exchangeOfferText,
    exchange_offer_image_url: r.exchangeOfferImageUrl,
    status: r.status,
    owner_response_message: r.ownerResponseMessage,
    created_at: r.createdAt,
  };
}

export function transactionView(
  t: Transaction & {
    coupon?: Pick<Coupon, "id" | "title" | "brand"> | null;
    owner?: OwnerRelation | null;
    claimant?: OwnerRelation | null;
    ratings?: Rating[];
  },
  viewerId?: string,
) {
  return {
    id: t.id,
    coupon_id: t.couponId,
    coupon: t.coupon
      ? { id: t.coupon.id, title: t.coupon.title, brand: t.coupon.brand }
      : null,
    owner: t.owner ? publicUser(t.owner) : null,
    claimant: t.claimant ? publicUser(t.claimant) : null,
    transaction_type: t.transactionType,
    status: t.status,
    role: viewerId
      ? viewerId === t.ownerId
        ? "owner"
        : viewerId === t.claimantId
          ? "claimant"
          : "other"
      : undefined,
    rated_by_viewer:
      viewerId && t.ratings ? t.ratings.some((rt) => rt.fromUserId === viewerId) : undefined,
    completed_at: t.completedAt,
    created_at: t.createdAt,
  };
}

export function notificationView(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    reference_type: n.referenceType,
    reference_id: n.referenceId,
    is_read: n.isRead,
    created_at: n.createdAt,
  };
}
