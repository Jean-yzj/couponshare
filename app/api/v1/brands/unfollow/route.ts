import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { requireActiveUser } from "@/lib/auth";
import { brandSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";

export const POST = route(async (req) => {
  throttle(req, "brand-unfollow", 80, 10 * 60_000);
  const user = await requireActiveUser();
  const { brand } = await readBody(req, brandSchema);
  await prisma.brandFollow.deleteMany({ where: { userId: user.id, brand } });
  return jsonOk({ brand, following: false });
});
