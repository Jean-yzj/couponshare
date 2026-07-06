import type { SocialPostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

// Admin review queue for 社群發文換申請次數. Defaults to PENDING. Returns the
// screenshot + link so the admin can verify the post and read the like count.
export const GET = route(async (req) => {
  await requireAdmin();
  const raw = new URL(req.url).searchParams.get("status") || "PENDING";
  const allowed = ["PENDING", "APPROVED", "REJECTED"];
  const status: SocialPostStatus = allowed.includes(raw) ? (raw as SocialPostStatus) : "PENDING";

  // NB: never select evidenceImage here — each is a ~700KB data-URI, so 200 of them
  // would be a multi-MB payload that times out on mobile (and the page would look
  // empty). The screenshot is served per-post from .../[id]/image instead.
  const posts = await prisma.socialPost.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 200,
    select: {
      id: true,
      topic: true,
      postDate: true,
      postUrl: true,
      status: true,
      bonusGranted: true,
      adminNote: true,
      createdAt: true,
      resolvedAt: true,
      user: {
        select: { id: true, displayName: true, avatarUrl: true, contributionScore: true, status: true },
      },
    },
  });

  return jsonOk({
    data: posts.map((p) => ({
      id: p.id,
      topic: p.topic,
      post_date: p.postDate,
      post_url: p.postUrl,
      status: p.status,
      bonus_granted: p.bonusGranted,
      admin_note: p.adminNote,
      created_at: p.createdAt,
      resolved_at: p.resolvedAt,
      user: p.user
        ? {
            id: p.user.id,
            display_name: p.user.displayName,
            avatar_url: p.user.avatarUrl,
            contribution_score: p.user.contributionScore,
            status: p.user.status,
          }
        : null,
    })),
  });
});
