import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { throttle } from "@/lib/throttle";

export const POST = route(async (req, ctx) => {
  throttle(req, "notif-read", 200, 10 * 60_000);
  const { id } = await ctx.params;
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true, readAt: new Date() },
  });
  return jsonOk({ ok: true });
});
