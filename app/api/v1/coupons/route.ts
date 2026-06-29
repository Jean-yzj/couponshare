import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createCouponSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const body = await readBody(req, createCouponSchema);

  const coupon = await prisma.coupon.create({
    data: {
      ownerId: user.id,
      title: body.title,
      brand: body.brand,
      category: body.category,
      description: body.description ?? null,
      expiryDate: body.expiry_date,
      type: body.type,
      exchangeTarget: body.exchange_target ?? null,
      unlockPolicy: body.unlock_policy ?? "OWNER_APPROVAL",
      visibilityLevel: body.visibility_level ?? "PUBLIC",
      status: "DRAFT",
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "coupon.create",
    targetType: "coupon",
    targetId: coupon.id,
    after: { status: "DRAFT" },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id: coupon.id, status: coupon.status }, 201);
});
