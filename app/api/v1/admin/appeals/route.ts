import type { AppealStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";

export const GET = route(async (req) => {
  await requireAdmin();
  const raw = (new URL(req.url).searchParams.get("status") || "PENDING").toUpperCase();
  const status = (["PENDING", "ACCEPTED", "REJECTED"].includes(raw) ? raw : "PENDING") as AppealStatus;

  const appeals = await prisma.appeal.findMany({
    where: { status },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk({
    data: appeals.map((a) => ({
      id: a.id,
      status: a.status,
      message: a.message,
      admin_note: a.adminNote,
      created_at: a.createdAt,
      resolved_at: a.resolvedAt,
      user: {
        id: a.user.id,
        display_name: a.user.displayName,
        avatar_url: a.user.avatarUrl,
        user_level: a.user.userLevel,
        level_name: LEVELS[a.user.userLevel].name,
        contribution_score: a.user.contributionScore,
        status: a.user.status,
      },
    })),
  });
});
