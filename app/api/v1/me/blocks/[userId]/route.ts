import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { throttle } from "@/lib/throttle";

export const DELETE = route<{ userId: string }>(async (req, ctx) => {
  throttle(req, "block-delete", 60, 10 * 60_000);
  const user = await requireUser();
  const { userId } = await ctx.params;

  await prisma.block.deleteMany({
    where: { blockerId: user.id, blockedId: userId },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "user.unblock",
    targetType: "user",
    targetId: userId,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ ok: true });
});
