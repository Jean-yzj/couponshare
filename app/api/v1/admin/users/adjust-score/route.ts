import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { applyScore } from "@/lib/score";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  email: z.string().trim().email("請輸入正確的 Email"),
  // Signed adjustment — positive to restore/grant, negative to deduct.
  delta: z
    .number()
    .int("請輸入整數")
    .refine((n) => n !== 0 && Math.abs(n) <= 100000, "調整值需為非零、且不超過 100000"),
  note: z.string().max(200).optional(),
});

// Admin manually adjusts a user's contribution score — e.g. to restore points that
// were wrongly deducted. Each call is its own ledger row (unique referenceId), so it
// stacks rather than de-duping, and recomputes the user's level via applyScore.
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { email, delta, note } = await readBody(req, schema);
  const meta = clientMeta(req);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, displayName: true, email: true, contributionScore: true },
  });
  if (!user) throw new ApiError("NOT_FOUND", { message: "找不到這個 Email 的使用者" });

  await applyScore(prisma, {
    userId: user.id,
    eventType: "ADMIN_ADJUSTMENT",
    delta,
    referenceType: "ADMIN",
    referenceId: randomUUID(),
    description: note?.trim() || (delta > 0 ? "管理員補回貢獻值" : "管理員調整貢獻值"),
  });

  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.score.adjust",
    targetType: "user",
    targetId: user.id,
    before: { contribution_score: user.contributionScore },
    after: { delta, note: note ?? null },
    ip: meta.ip,
    ua: meta.ua,
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { displayName: true, email: true, contributionScore: true },
  });

  return jsonOk({
    user: {
      display_name: updated?.displayName ?? user.displayName,
      email: updated?.email ?? user.email,
      before: user.contributionScore,
      contribution_score: updated?.contributionScore ?? user.contributionScore,
    },
    delta,
  });
});
