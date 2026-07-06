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

  const posts = await prisma.socialPost.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 200,
    include: {
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
      evidence_image: p.evidenceImage,
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
