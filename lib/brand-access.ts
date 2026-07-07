import { getFlag, FLAG_BRAND_COUPONS } from "./settings";
import { getCurrentUser } from "./auth";
import { isAdmin } from "./admin";

// The enterprise brand-coupon surface is dark-launched: while the master flag is
// off, it's invisible to regular users. Admins can still see everything so the
// founder can click through the whole flow before flipping it on for real.
export async function brandCouponsVisible(): Promise<boolean> {
  if (await getFlag(FLAG_BRAND_COUPONS)) return true;
  const user = await getCurrentUser();
  return !!user && isAdmin(user);
}
