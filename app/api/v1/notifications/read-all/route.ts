import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { throttle } from "@/lib/throttle";

export const POST = route(async (req) => {
  throttle(req, "notif-read-all", 60, 10 * 60_000);
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return jsonOk({ ok: true });
});
