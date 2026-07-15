import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { brandCouponsVisible } from "@/lib/brand-access";

export const runtime = "nodejs";

// Increment click_count for a brand coupon when the user taps the redemption CTA.
// Fire-and-forget from the client — responds with 200 immediately.
// Gated: flag OFF → 404 for regular users (same gate as the detail API).
export const POST = route(async (req, ctx) => {
  if (!(await brandCouponsVisible())) throw new ApiError("NOT_FOUND");
  const { id } = await ctx.params;

  const coupon = await prisma.brandCoupon.findUnique({ where: { id }, select: { id: true } });
  if (!coupon) throw new ApiError("NOT_FOUND");

  await prisma.brandCoupon.update({ where: { id }, data: { clickCount: { increment: 1 } } });

  return jsonOk({ ok: true });
});
