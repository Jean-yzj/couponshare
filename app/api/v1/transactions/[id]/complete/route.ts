import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// GIFT: either party confirming completes it. EXCHANGE: BOTH must confirm
// (each side gives something). PRD §7.3.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  const isOwner = t.ownerId === user.id;
  const isClaimant = t.claimantId === user.id;
  if (!isOwner && !isClaimant) throw new ApiError("FORBIDDEN");
  if (t.status === "COMPLETED") {
    return jsonOk({ transaction_id: id, status: "COMPLETED" });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: isOwner ? { ownerCompleted: true } : { claimantCompleted: true },
  });

  const done =
    updated.transactionType === "EXCHANGE"
      ? updated.ownerCompleted && updated.claimantCompleted
      : updated.ownerCompleted || updated.claimantCompleted;

  if (done) {
    await prisma.transaction.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    const other = isOwner ? t.claimantId : t.ownerId;
    await notify(prisma, {
      userId: other,
      type: "TRANSACTION_COMPLETED",
      title: "交易已完成",
      body: "對方已確認完成，別忘了留下評價與感謝",
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
  }

  // Exchange: waiting for the other side to also confirm.
  return jsonOk({
    transaction_id: id,
    status: "CREATED",
    owner_completed: updated.ownerCompleted,
    claimant_completed: updated.claimantCompleted,
    waiting_for_other: true,
  });
});
