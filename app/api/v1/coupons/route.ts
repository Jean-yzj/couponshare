import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createCouponSchema } from "@/lib/validation";
import { encryptBarcode } from "@/lib/crypto";
import { normalizeBrand } from "@/lib/brands";
import { findBlockedContent, blockedContentMessage } from "@/lib/contentPolicy";

export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const body = await readBody(req, createCouponSchema);

  // 關鍵字黑名單（菸酒藥、彩券等）— 與 app/new/Client.tsx 共用 lib/contentPolicy.ts，
  // 這裡是繞過前端直打 API 的後盾。
  const blocked = findBlockedContent(`${body.title} ${body.description ?? ""}`);
  if (blocked) {
    throw new ApiError("VALIDATION_ERROR", { message: blockedContentMessage(blocked) });
  }

  const coupon = await prisma.coupon.create({
    data: {
      ownerId: user.id,
      title: body.title,
      brand: normalizeBrand(body.brand),
      category: body.category,
      redeemKind: body.redeem_kind,
      redeemCodeEncrypted: body.redeem_code
        ? encryptBarcode(Buffer.from(body.redeem_code, "utf8"))
        : null,
      description: body.description ?? null,
      expiryDate: body.expiry_date ?? null,
      type: body.type,
      exchangeTarget: body.exchange_target ?? null,
      unlockPolicy: body.type === "GIFT" ? (body.unlock_policy ?? "OWNER_APPROVAL") : "OWNER_APPROVAL",
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
