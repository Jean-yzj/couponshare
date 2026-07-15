import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { adminAssignBrandSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Admin turns a person (by email) into a brand owner: creates a brand they manage
// at the chosen plan tier. The user then sees 企業後台 in their menu.
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { email, brand_name, plan } = await readBody(req, adminAssignBrandSchema);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, displayName: true, email: true },
  });
  if (!user) throw new ApiError("NOT_FOUND", { message: "找不到這個 Email 的使用者（對方要先註冊過）" });

  // If the user already self-created a pending brand, approve that one instead of
  // creating a duplicate — otherwise they'd end up managing two brands.
  const existing = await prisma.brand.findFirst({
    where: { ownerUserId: user.id },
    select: { id: true, name: true, status: true },
  });
  if (existing && existing.status === "ACTIVE") {
    throw new ApiError("VALIDATION_ERROR", { message: `對方已有已核准的品牌「${existing.name}」，不需重複開通` });
  }

  // Admin-assigned brands are pre-approved (admin assigns only after contract is signed).
  const brand = existing
    ? await prisma.brand.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", plan },
        select: { id: true },
      })
    : await prisma.brand.create({
        data: { name: brand_name, logoText: brand_name.slice(0, 1), ownerUserId: user.id, plan, status: "ACTIVE" },
        select: { id: true },
      });

  const liveName = existing ? existing.name : brand_name;
  await notify(prisma, {
    userId: user.id,
    type: "BUSINESS_LEAD_RECEIVED",
    title: "你的企業後台已開通",
    body: `「${liveName}」的企業後台已為你開通，點右上選單的「企業後台」即可上架官方福利券。`,
    referenceType: "brand_owner",
    referenceId: brand.id,
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.brand.assign_owner",
    targetType: "brand",
    targetId: brand.id,
    after: { ownerUserId: user.id, plan, brand_name },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id: brand.id, user: { display_name: user.displayName, email: user.email } }, 201);
});
