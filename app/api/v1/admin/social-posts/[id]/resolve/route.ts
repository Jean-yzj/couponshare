import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { grantBonusClaims } from "@/lib/bonus";
import { applyScore, SCORE_RULES } from "@/lib/score";
import { socialPostResolveSchema } from "@/lib/validation";

// Admin decides a 社群發文換申請次數 submission. APPROVE grants the chosen tier
// (+10 normal, +20 when the screenshot shows 100+ likes) into the monthly claim
// pool, plus +5 contribution score. REJECT (negative / unverifiable) grants nothing.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { decision, bonus, note } = await readBody(req, socialPostResolveSchema);
  const meta = clientMeta(req);

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!post) throw new ApiError("NOT_FOUND");
  if (post.status !== "PENDING") throw new ApiError("VALIDATION_ERROR", { message: "這則發文已審核" });

  if (decision === "APPROVE") {
    const amount = bonus ?? 10; // default to the normal tier if not specified
    await prisma.$transaction(async (tx) => {
      await tx.socialPost.update({
        where: { id },
        data: { status: "APPROVED", bonusGranted: amount, adminNote: note ?? null, resolvedAt: new Date() },
      });
      await grantBonusClaims(tx, post.userId, amount);
      await applyScore(tx, {
        userId: post.userId,
        eventType: "SOCIAL_POST_APPROVED",
        delta: SCORE_RULES.SOCIAL_POST_APPROVED,
        referenceType: "ADMIN",
        referenceId: post.id,
        description: "社群發文審核通過",
      });
      await notify(tx, {
        userId: post.userId,
        type: "SOCIAL_POST_UPDATED",
        title: "發文獎勵審核通過",
        body: `你的社群發文已通過審核：本月申請次數 +${amount}、貢獻值 +${SCORE_RULES.SOCIAL_POST_APPROVED}。感謝你的分享！`,
        referenceType: "social_post",
        referenceId: post.id,
      });
      await writeAudit(tx, {
        actorId: admin.id,
        action: "social_post.approve",
        targetType: "social_post",
        targetId: id,
        after: { bonus: amount, note: note ?? null },
        ip: meta.ip,
        ua: meta.ua,
      });
    });
    return jsonOk({ id, status: "APPROVED", bonus: amount });
  }

  // REJECT
  await prisma.$transaction(async (tx) => {
    await tx.socialPost.update({
      where: { id },
      data: { status: "REJECTED", adminNote: note ?? null, resolvedAt: new Date() },
    });
    await notify(tx, {
      userId: post.userId,
      type: "SOCIAL_POST_UPDATED",
      title: "發文獎勵審核未通過",
      body: `你的社群發文未通過審核${note ? `：${note}` : "（例如內容偏負面、無法確認，或帳號未公開）"}。下個月可以再提交一次。`,
      referenceType: "social_post",
      referenceId: post.id,
    });
    await writeAudit(tx, {
      actorId: admin.id,
      action: "social_post.reject",
      targetType: "social_post",
      targetId: id,
      after: { note: note ?? null },
      ip: meta.ip,
      ua: meta.ua,
    });
  });
  return jsonOk({ id, status: "REJECTED" });
});
