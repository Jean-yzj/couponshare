import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { LEVELS } from "@/lib/levels";
import { avatarRef } from "@/lib/serialize";

// Contribution leaderboard — top active members by contribution score, plus the
// viewer's own rank so they can see where they stand.
export const GET = route(async () => {
  const me = await requireUser();

  const rows = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ contributionScore: "desc" }, { createdAt: "asc" }],
    take: 50,
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      userLevel: true,
      contributionScore: true,
    },
  });

  const top = rows.map((u, i) => ({
    rank: i + 1,
    id: u.id,
    display_name: u.displayName,
    avatar_url: avatarRef(u),
    user_level: u.userLevel,
    level_name: LEVELS[u.userLevel].name,
    contribution_score: u.contributionScore,
  }));

  // Your rank = number of active members with a strictly higher score, + 1.
  const higher = await prisma.user.count({
    where: { status: "ACTIVE", contributionScore: { gt: me.contributionScore } },
  });

  return jsonOk({
    top,
    me: { rank: higher + 1, contribution_score: me.contributionScore },
  });
});
