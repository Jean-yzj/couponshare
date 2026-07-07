import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { ownsCoupon } from "@/lib/brand-access";
import { writeAudit } from "@/lib/audit";
import { validateDataUriImage } from "@/lib/image";
import { brandCouponCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Brand owner edits an existing coupon (title, mode, redeem, image, task, CTA).
export const POST = route(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const brandId = await ownsCoupon(user.id, id);
  if (!brandId) throw new ApiError("FORBIDDEN");
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { plan: true } });
  const body = await readBody(req, brandCouponCreateSchema);

  if (body.application_mode === "TASK_UNLOCK" && brand?.plan !== "MAX") {
    throw new ApiError("VALIDATION_ERROR", { message: "「任務解鎖」是 Max 方案專屬，請升級後使用。" });
  }
  const isTask = body.application_mode === "TASK_UNLOCK";

  await prisma.brandCoupon.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description || null,
      category: body.category || null,
      redeemInfo: body.redeem_info || null,
      imageUrl: body.image_url ? validateDataUriImage(body.image_url, 700 * 1024) : null,
      applicationMode: body.application_mode,
      taskInstruction: isTask ? body.task_instruction || null : null,
      taskUrl: isTask ? body.task_url || null : null,
      maxApplications: body.max_applications,
      maxPerUser: body.max_per_user,
      ctaText: body.cta_text || null,
      ctaUrl: body.cta_url || null,
      usageExpiry: body.usage_expiry || null,
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "brand.coupon.edit",
    targetType: "brand_coupon",
    targetId: id,
    after: { title: body.title },
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id });
});
