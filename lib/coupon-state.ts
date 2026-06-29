import type { CouponStatus } from "@prisma/client";
import { ApiError } from "./errors";

// PRD §5.2. Note: AVAILABLE → CLAIMED is included because the MVP uses the
// owner-approval (multi-applicant) model where the coupon stays AVAILABLE while
// requests arrive and moves straight to CLAIMED on approval (PRD §7.2 / §24.1).
export const COUPON_TRANSITIONS: Record<CouponStatus, CouponStatus[]> = {
  DRAFT: ["AVAILABLE", "CANCELLED"],
  AVAILABLE: ["PENDING", "CLAIMED", "CANCELLED", "EXPIRED", "REPORTED"],
  PENDING: ["CLAIMED", "AVAILABLE", "CANCELLED", "EXPIRED"],
  CLAIMED: ["REPORTED"],
  EXPIRED: [],
  CANCELLED: [],
  REPORTED: ["SUSPENDED", "CLAIMED", "EXPIRED"],
  SUSPENDED: ["AVAILABLE", "CANCELLED"],
};

export function canTransition(from: CouponStatus, to: CouponStatus): boolean {
  return COUPON_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CouponStatus, to: CouponStatus): void {
  if (!canTransition(from, to)) throw new ApiError("INVALID_STATUS_TRANSITION", { from, to });
}
