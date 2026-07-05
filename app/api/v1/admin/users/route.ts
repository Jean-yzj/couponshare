import type { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";

// Admin roster of accounts by status — defaults to SUSPENDED so the admin can see
// exactly who is currently locked out (and restore anyone caught by a wrong call or
// a malicious-report brigade). PRD §9 / terms §5.
const SUSPEND_ACTIONS = ["user.suspend", "user.auto_suspend", "user.suspend_malicious_reporter"];
const REASON_LABEL: Record<string, string> = {
  "user.suspend": "管理員手動停權",
  "user.auto_suspend": "被 3 人以上檢舉自動停權",
  "user.suspend_malicious_reporter": "累積惡意檢舉自動停權",
};

export const GET = route(async (req) => {
  await requireAdmin();
  const raw = new URL(req.url).searchParams.get("status") || "SUSPENDED";
  const status = (["ACTIVE", "SUSPENDED", "DELETED"] as const).includes(raw as UserStatus)
    ? (raw as UserStatus)
    : "SUSPENDED";

  const users = await prisma.user.findMany({
    where: { status } as Prisma.UserWhereInput,
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      loginProvider: true,
      contributionScore: true,
      userLevel: true,
      riskFlag: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Best-effort "why suspended" from the most recent suspend audit keyed on the user.
  const ids = users.map((u) => u.id);
  const audits = ids.length
    ? await prisma.auditLog.findMany({
        where: { targetType: "user", targetId: { in: ids }, action: { in: SUSPEND_ACTIONS } },
        orderBy: { createdAt: "desc" },
        select: { targetId: true, action: true, createdAt: true },
      })
    : [];
  const reasonById = new Map<string, { action: string; at: Date }>();
  for (const a of audits) {
    if (a.targetId && !reasonById.has(a.targetId)) {
      reasonById.set(a.targetId, { action: a.action, at: a.createdAt });
    }
  }

  return jsonOk({
    data: users.map((u) => {
      const r = reasonById.get(u.id);
      return {
        id: u.id,
        display_name: u.displayName,
        email: u.email,
        avatar_url: u.avatarUrl,
        provider: u.loginProvider,
        contribution_score: u.contributionScore,
        level_name: LEVELS[u.userLevel].name,
        risk_flag: u.riskFlag,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
        suspend_reason: r ? (REASON_LABEL[r.action] ?? r.action) : "原因未記錄",
        suspended_at: r ? r.at : null,
      };
    }),
  });
});
