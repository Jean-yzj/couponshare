import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { socialPostSchema } from "@/lib/validation";
import { validateDataUriImage } from "@/lib/image";
import { startOfMonthTaipei, monthKeyTaipei } from "@/lib/time";

// 社群發文換申請次數 — submit proof of a CouponShare post for review.
// One submission per user per Taipei calendar month, capped at MONTH_CAP
// participants platform-wide per month (once full, this month's posts earn nothing,
// so we stop accepting submissions rather than collect posts we won't reward).
const MONTH_CAP = 500;

export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const body = await readBody(req, socialPostSchema);

  // Screenshot must be a real inline image (the admin reads the like count off it).
  // Magic-byte validated — a direct API caller can't slip in an SVG or malformed
  // blob that the admin console would then render.
  // Cap set above the schema's base64 length limit so size is enforced there (clear
  // error); this call's job is the magic-byte/format check.
  const evidenceImage = validateDataUriImage(body.evidence_image, 700 * 1024);
  if (!evidenceImage) {
    throw new ApiError("VALIDATION_ERROR", { message: "請上傳貼文截圖" });
  }

  const monthStart = startOfMonthTaipei();
  const [already, monthCount] = await Promise.all([
    prisma.socialPost.findFirst({
      where: { userId: user.id, createdAt: { gte: monthStart } },
      select: { id: true },
    }),
    prisma.socialPost.count({ where: { createdAt: { gte: monthStart } } }),
  ]);
  if (already) {
    throw new ApiError("VALIDATION_ERROR", { message: "你這個月已經提交過了，不可以再提交" });
  }
  if (monthCount >= MONTH_CAP) {
    throw new ApiError("VALIDATION_ERROR", {
      message: `本月 ${MONTH_CAP} 個名額已滿，這個月發文不會獲得獎勵，下個月 1 號重新開放`,
    });
  }

  const post = await prisma.socialPost.create({
    data: {
      userId: user.id,
      topic: body.topic,
      postDate: body.post_date,
      postUrl: body.post_url,
      evidenceImage,
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
// page can show the right blocked state (already submitted vs 名額已滿) and the
// month's participation progress toward MONTH_CAP.
export const GET = route(async () => {
  const user = await requireActiveUser();
  const monthStart = startOfMonthTaipei();

  const [posts, monthCount] = await Promise.all([
    prisma.socialPost.findMany({
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
    }),
    prisma.socialPost.count({ where: { createdAt: { gte: monthStart } } }),
  ]);
  const thisMonth = posts.find((p) => p.createdAt >= monthStart) ?? null;
  const poolRemaining =
    user.bonusClaimsMonth === monthKeyTaipei() ? Math.max(0, user.bonusClaims) : 0;
  const quotaFull = monthCount >= MONTH_CAP;

  return jsonOk({
    pool_remaining: poolRemaining,
    month_count: monthCount,
    month_cap: MONTH_CAP,
    blocked_reason: thisMonth ? "already_submitted" : quotaFull ? "quota_full" : null,
    can_submit: !thisMonth && !quotaFull,
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
