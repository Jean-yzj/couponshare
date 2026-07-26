import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { requireActiveUser } from "@/lib/auth";
import { brandSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";

export const POST = route(async (req) => {
  throttle(req, "brand-follow", 80, 10 * 60_000);
  const user = await requireActiveUser();
  const { brand } = await readBody(req, brandSchema);
  await prisma.brandFollow.upsert({
    where: { userId_brand: { userId: user.id, brand } },
    create: { userId: user.id, brand },
    update: {},
  });
  return jsonOk({ brand, following: true });
});
