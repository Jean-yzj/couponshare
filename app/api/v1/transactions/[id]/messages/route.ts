import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { transactionMessageSchema } from "@/lib/validation";

// Coordination chat for a transaction (mainly exchanges). PRD §6.5.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const body = await readBody(req, transactionMessageSchema);

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.ownerId !== user.id && t.claimantId !== user.id) throw new ApiError("FORBIDDEN");

  const msg = await prisma.transactionMessage.create({
    data: { transactionId: id, senderId: user.id, message: body.message },
  });

  const other = user.id === t.ownerId ? t.claimantId : t.ownerId;
  await notify(prisma, {
    userId: other,
    type: "TRANSACTION_MESSAGE",
    title: "新的交換訊息",
    body: `${user.displayName}：${body.message.slice(0, 40)}`,
    referenceType: "transaction",
    referenceId: id,
  });

  return jsonOk({ id: msg.id, created_at: msg.createdAt }, 201);
});
