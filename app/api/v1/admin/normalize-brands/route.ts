import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { normalizeBrand } from "@/lib/brands";

// One-off (idempotent): rewrite existing coupon brands to their canonical name so
// old 711 / 7-ELEVEN listings merge with 7-11 in search & feed. Admin-gated — it's
// a bulk maintenance mutation, so it belongs with the other admin actions rather
// than the lower-privilege cron secret.
export const POST = route(async () => {
  await requireAdmin();
  const coupons = await prisma.coupon.findMany({ select: { id: true, brand: true }, take: 10000 });
  let changed = 0;
  for (const c of coupons) {
    const norm = normalizeBrand(c.brand);
    if (norm !== c.brand) {
      await prisma.coupon.update({ where: { id: c.id }, data: { brand: norm } });
      changed++;
    }
  }
  return jsonOk({ scanned: coupons.length, changed });
});
