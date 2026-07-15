import { getFlag, FLAG_BRAND_COUPONS } from "./settings";
import { getCurrentUser } from "./auth";
import { isAdmin } from "./admin";
import { prisma } from "./db";

// Does `userId` manage this brand? (brand self-serve back office authorization)
export async function ownsBrand(userId: string, brandId: string): Promise<boolean> {
  return (await prisma.brand.count({ where: { id: brandId, ownerUserId: userId } })) > 0;
}

// Does `userId` own the brand this coupon belongs to?
export async function ownsCoupon(userId: string, couponId: string): Promise<string | null> {
  const c = await prisma.brandCoupon.findUnique({
    where: { id: couponId },
    select: { brand: { select: { id: true, ownerUserId: true } } },
  });
  return c && c.brand.ownerUserId === userId ? c.brand.id : null;
}

// The enterprise brand-coupon surface is dark-launched: while the master flag is
// off, it's invisible to regular users. Admins can still see everything so the
// founder can click through the whole flow before flipping it on for real.
export async function brandCouponsVisible(): Promise<boolean> {
  if (await getFlag(FLAG_BRAND_COUPONS)) return true;
  const user = await getCurrentUser();
  return !!user && isAdmin(user);
}

// Returns whether a brand's status makes it publicly visible (status = ACTIVE).
// Admins bypass this gate so they can preview any brand regardless of status.
// Call this after brandCouponsVisible() has already passed.
export async function brandPubliclyVisible(brandId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (user && isAdmin(user)) return true;
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { status: true } });
  return brand?.status === "ACTIVE";
}

// Same check but for a brand coupon — resolves the brandId first.
export async function brandCouponPubliclyVisible(couponId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (user && isAdmin(user)) return true;
  const coupon = await prisma.brandCoupon.findUnique({
    where: { id: couponId },
    select: { brand: { select: { status: true } } },
  });
  return coupon?.brand?.status === "ACTIVE";
}
