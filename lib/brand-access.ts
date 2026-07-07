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
