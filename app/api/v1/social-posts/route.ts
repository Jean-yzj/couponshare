import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { socialPostSchema } from "@/lib/validation";
import { startOfMonthTaipei, monthKeyTaipei } from "@/lib/time";

// 社群發文換申請次數 — submit proof of a #CouponShare post for review.
// One submission per user per Taipei calendar month (regardless of outcome).
export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const body = await readBody(req, socialPostSchema);

  // Screenshot must be an inline data-URI (the admin reads the like count off it);
  // the link is the public post URL.
  if (!body.evidence_image.startsWith("data:image/")) {
    throw new ApiError("VALIDATION_ERROR", { message: "請上傳貼文截圖" });
  }

  const monthStart = startOfMonthTaipei();
  const already = await prisma.socialPost.findFirst({
    where: { userId: user.id, createdAt: { gte: monthStart } },
    select: { id: true },
  });
  if (already) {
    throw new ApiError("VALIDATION_ERROR", { message: "你這個月已經提交過了，不可以再提交" });
  }

  const post = await prisma.socialPost.create({
    data: {
      userId: user.id,
      topic: body.topic,
      postDate: body.post_date,
      postUrl: body.post_url,
      evidenceImage: body.evidence_image,
      status: "PENDING",
    },
    select: { id: true, status: true, createdAt: true },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "social_post.submit",
    targetType: "social_post",
    targetId: post.id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id: post.id, status: post.status }, 201);
});

// The user's own submission history + whether they may submit this month, so the
// page can show "你這個月已經提交過了，不可以再提交" instead of letting them retry.
export const GET = route(async () => {
  const user = await requireActiveUser();
  const monthStart = startOfMonthTaipei();

  const posts = await prisma.socialPost.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      topic: true,
      postUrl: true,
      status: true,
      bonusGranted: true,
      adminNote: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
  const thisMonth = posts.find((p) => p.createdAt >= monthStart) ?? null;
  const poolRemaining =
    user.bonusClaimsMonth === monthKeyTaipei() ? Math.max(0, user.bonusClaims) : 0;

  return jsonOk({
    pool_remaining: poolRemaining,
    can_submit: !thisMonth,
    this_month: thisMonth
      ? { id: thisMonth.id, status: thisMonth.status, created_at: thisMonth.createdAt }
      : null,
    posts: posts.map((p) => ({
      id: p.id,
      topic: p.topic,
      post_url: p.postUrl,
      status: p.status,
      bonus_granted: p.bonusGranted,
      admin_note: p.adminNote,
      created_at: p.createdAt,
      resolved_at: p.resolvedAt,
    })),
  });
});
