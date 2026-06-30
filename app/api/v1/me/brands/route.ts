import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const user = await requireUser();
  const follows = await prisma.brandFollow.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({ brands: follows.map((f) => f.brand) });
});
