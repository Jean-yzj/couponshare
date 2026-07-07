import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { brandCouponsVisible } from "@/lib/brand-access";
import { brandCouponApplySchema } from "@/lib/validation";

export const runtime = "nodejs";

// A user claims / applies for a brand coupon. DIRECT_CLAIM lands as CLAIMED and
// takes a quota slot immediately; MESSAGE_APPLICATION lands as PENDING for admin
// review (quota consumed only on approval). One per user, enforced by the unique
// (coupon, user) index. Gated.
export const POST = route(async (req, ctx) => {
  if (!(await brandCouponsVisible())) throw new ApiError("NOT_FOUND");
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const body = await readBody(req, brandCouponApplySchema);

  const coupon = await prisma.brandCoupon.findUnique({
    where: { id },
    select: { id: true, status: true, applicationMode: true, maxApplications: true },
  });
  if (!coupon) throw new ApiError("NOT_FOUND");
  if (coupon.status !== "ACTIVE") {
    throw new ApiError("VALIDATION_ERROR", { message: "這張券目前無法領取" });
  }

  const direct = coupon.applicationMode === "DIRECT_CLAIM";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.brandCouponApplication.create({
        data: {
          brandCouponId: id,
          userId: user.id,
          message: body.message?.trim() || null,
          status: direct ? "CLAIMED" : "PENDING",
        },
      });
      if (direct) {
        // Atomically take a slot only if one is left; 0 rows → quota full → rollback.
        const took = await tx.brandCoupon.updateMany({
          where: { id, applicationCount: { lt: coupon.maxApplications } },
          data: { applicationCount: { increment: 1 } },
        });
        if (took.count === 0) throw new ApiError("VALIDATION_ERROR", { message: "這張券的名額已經領完了" });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("VALIDATION_ERROR", { message: "你已經領過這張券了" });
    }
    throw e;
  }

  return jsonOk({ status: direct ? "CLAIMED" : "PENDING" }, 201);
});
