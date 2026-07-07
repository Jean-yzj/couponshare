import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { ownsBrand } from "@/lib/brand-access";
import { writeAudit } from "@/lib/audit";
import { validateDataUriImage } from "@/lib/image";
import { brandEditSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Brand owner edits their brand's public identity (name, category, logo image).
export const POST = route(async (req, ctx) => {
  const user = await requireActiveUser();
  const { brandId } = await ctx.params;
  if (!(await ownsBrand(user.id, brandId))) throw new ApiError("FORBIDDEN");
  const body = await readBody(req, brandEditSchema);

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      name: body.name,
      category: body.category?.trim() || null,
      description: body.description?.trim() || null,
      logoText: body.name.slice(0, 1),
      logoUrl: body.logo_url ? validateDataUriImage(body.logo_url, 400 * 1024) : null,
    },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "brand.edit",
    targetType: "brand",
    targetId: brandId,
    after: { name: body.name },
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id: brandId });
});
