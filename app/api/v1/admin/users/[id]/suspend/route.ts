import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { blockUserRecentIps } from "@/lib/blocked-ip";

const schema = z.object({ reason: z.string().max(300).optional() });

// Admin suspends a user directly (e.g. from a bad coupon's page) and delists all
// their active listings. Mirrors the report-resolve suspend action.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { reason } = await readBody(req, schema);
  const meta = clientMeta(req);

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!target) throw new ApiError("NOT_FOUND");
  if (target.id === admin.id) throw new ApiError("VALIDATION_ERROR", { message: "不能停權自己" });
  if (target.status === "SUSPENDED") return jsonOk({ id, already_suspended: true });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status: "SUSPENDED" } });
    await tx.coupon.updateMany({
      where: { ownerId: id, status: { in: ["AVAILABLE", "PENDING", "REPORTED"] } },
      data: { status: "SUSPENDED" },
    });
    await notify(tx, {
      userId: id,
      type: "REPORT_UPDATED",
      title: "你的帳號已被暫停",
      body: `你的帳號因違反平台規範已被暫停，相關票券已下架${reason ? `：${reason}` : ""}。如有疑問可提出申訴。`,
    });
    await writeAudit(tx, {
      actorId: admin.id,
      action: "user.suspend",
      targetType: "user",
      targetId: id,
      after: { reason: reason ?? null },
      ip: meta.ip,
      ua: meta.ua,
    });
    // Block their recent IPs from registering fresh accounts (evasion).
    await blockUserRecentIps(tx, id, "帳號手動停權");
  });

  return jsonOk({ id, suspended: true });
});
