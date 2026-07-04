import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { destroySession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const meta = clientMeta(req);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.coupon.updateMany({
      where: { ownerId: user.id, status: "AVAILABLE" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await tx.pushToken.deleteMany({ where: { userId: user.id } });
    await tx.brandFollow.deleteMany({ where: { userId: user.id } });
    await tx.block.deleteMany({
      where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        email: null,
        passwordHash: null,
        appleSub: null,
        avatarUrl: null,
        displayName: "已刪除的使用者",
      },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: "user.delete",
      targetType: "user",
      targetId: user.id,
      before: { status: user.status, email: user.email },
      after: { status: "DELETED" },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  await destroySession();
  return jsonOk({ ok: true });
});
