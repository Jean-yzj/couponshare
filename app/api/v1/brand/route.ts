import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { brandCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

// A user creates a brand they own (self-serve onboarding). Capped so a single
// account can't spin up unlimited brands.
export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const existing = await prisma.brand.count({ where: { ownerUserId: user.id } });
  if (existing >= 5) {
    return jsonOk({ error: "已達品牌數上限" }, 400);
  }
  const body = await readBody(req, brandCreateSchema);
  const brand = await prisma.brand.create({
    data: {
      name: body.name,
      logoText: body.logo_text?.trim() || body.name.slice(0, 1),
      category: body.category || null,
      description: body.description || null,
      websiteUrl: body.website_url || null,
      ownerUserId: user.id,
    },
    select: { id: true, name: true },
  });
  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "brand.self_create",
    targetType: "brand",
    targetId: brand.id,
    after: { name: brand.name },
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id: brand.id }, 201);
});
