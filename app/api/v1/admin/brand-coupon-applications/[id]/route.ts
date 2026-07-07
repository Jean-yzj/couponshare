import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { brandApplicationDecisionSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Admin approves / rejects a MESSAGE_APPLICATION application. Approve marks it
// CLAIMED (the redeem info becomes visible to the user) and consumes one quota
// slot; the applicant is notified either way.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { decision } = await readBody(req, brandApplicationDecisionSchema);

  const app = await prisma.brandCouponApplication.findUnique({
    where: { id },
    include: { coupon: { select: { id: true, title: true, applicationCount: true, maxApplications: true } } },
  });
  if (!app) throw new ApiError("NOT_FOUND");
  if (app.status !== "PENDING") {
    throw new ApiError("VALIDATION_ERROR", { message: "這筆申請已經處理過了" });
  }

  if (decision === "APPROVE") {
    if (app.coupon.applicationCount >= app.coupon.maxApplications) {
      throw new ApiError("VALIDATION_ERROR", { message: "這張券的名額已經滿了" });
    }
    await prisma.$transaction([
      prisma.brandCouponApplication.update({
        where: { id },
        data: { status: "CLAIMED", decidedAt: new Date() },
      }),
      prisma.brandCoupon.update({
        where: { id: app.coupon.id },
        data: { applicationCount: { increment: 1 } },
      }),
    ]);
  } else {
    await prisma.brandCouponApplication.update({
      where: { id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
  }

  await notify(prisma, {
    userId: app.userId,
    type: "CLAIM_APPROVED",
    title: decision === "APPROVE" ? "官方福利券申請通過" : "官方福利券申請結果",
    body:
      decision === "APPROVE"
        ? `你申請的「${app.coupon.title}」已通過，可以查看兌換方式了。`
        : `你申請的「${app.coupon.title}」這次未通過，別灰心，還有其他福利券可以領。`,
    referenceType: "brand_coupon",
    referenceId: app.coupon.id,
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: decision === "APPROVE" ? "admin.brand_application.approve" : "admin.brand_application.reject",
    targetType: "brand_coupon_application",
    targetId: id,
    after: { decision },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id, status: decision === "APPROVE" ? "CLAIMED" : "REJECTED" });
});
