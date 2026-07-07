import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { ownsCoupon } from "@/lib/brand-access";
import { writeAudit } from "@/lib/audit";
import { brandCouponStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Brand owner flips one of their coupons ACTIVE / PAUSED / ENDED / DRAFT.
export const POST = route(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  if (!(await ownsCoupon(user.id, id))) throw new ApiError("FORBIDDEN");
  const { status } = await readBody(req, brandCouponStatusSchema);

  await prisma.brandCoupon.update({ where: { id }, data: { status } });
  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "brand.coupon.status",
    targetType: "brand_coupon",
    targetId: id,
    after: { status },
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id, status });
});
