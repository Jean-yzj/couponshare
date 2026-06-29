import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// MVP: either party may confirm completion (PRD §7.3 allows the simplified rule).
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.ownerId !== user.id && t.claimantId !== user.id) throw new ApiError("FORBIDDEN");
  if (t.status === "COMPLETED") return jsonOk({ transaction_id: id, status: "COMPLETED" });

  await prisma.transaction.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const other = user.id === t.ownerId ? t.claimantId : t.ownerId;
  await notify(prisma, {
    userId: other,
    type: "TRANSACTION_COMPLETED",
    title: "交易已完成",
    body: "對方已確認交易完成，別忘了留下評價與感謝",
    referenceType: "transaction",
    referenceId: id,
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "transaction.complete",
    targetType: "transaction",
    targetId: id,
    after: { status: "COMPLETED" },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ transaction_id: id, status: "COMPLETED" });
});
