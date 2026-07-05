import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["dismiss", "remove_coupon", "suspend_user", "dismiss_malicious", "strike_user"]),
  note: z.string().max(300).optional(),
});

// A reporter who racks up this many malicious/false reports gets auto-suspended.
const MALICIOUS_REPORT_LIMIT = 3;
// A reported user who racks up this many admin-confirmed (成立) reports gets
// auto-suspended — the "累積檢舉" path for violations that aren't severe enough
// to suspend on the first strike.
const CONFIRMED_STRIKE_LIMIT = 3;

// Admin decides a report. dismiss = no violation (re-list the coupon if it had
// been auto-flagged REPORTED); remove_coupon = take that listing down;
// suspend_user = suspend the account + pull all its listings. Terms §5.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { action, note } = await readBody(req, schema);
  const meta = clientMeta(req);

  const report = await prisma.report.findUnique({ where: { id }, include: { coupon: true } });
  if (!report) throw new ApiError("NOT_FOUND");
  if (!["PENDING", "REVIEWING"].includes(report.status)) {
    throw new ApiError("VALIDATION_ERROR", { message: "此檢舉已處理" });
  }
  // Who is accountable for this report: the named user, else the coupon's owner.
  const offenderId = report.reportedUserId ?? report.coupon?.ownerId ?? null;

  await prisma.$transaction(async (tx) => {
    if (action === "dismiss") {
      await tx.report.update({
        where: { id },
        data: { status: "REJECTED", adminNote: note ?? null, resolvedAt: new Date() },
      });
      // If this coupon had been auto-flagged REPORTED purely by report count,
      // clearing a report puts it back on the shelf.
      if (report.coupon && report.coupon.status === "REPORTED") {
        await tx.coupon.update({ where: { id: report.coupon.id }, data: { status: "AVAILABLE" } });
      }
    } else if (action === "dismiss_malicious") {
      // Same as dismiss (no violation, re-list the coupon) BUT this report was
      // judged malicious/false, so it counts as a strike against the REPORTER.
      await tx.report.update({
        where: { id },
        data: { status: "REJECTED", adminNote: note ?? null, resolvedAt: new Date() },
      });
      if (report.coupon && report.coupon.status === "REPORTED") {
        await tx.coupon.update({ where: { id: report.coupon.id }, data: { status: "AVAILABLE" } });
      }
      // Strike is keyed on the reporter (actorId) so we can count their history.
      await writeAudit(tx, {
        actorId: report.reporterId,
        action: "report.malicious_strike",
        targetType: "report",
        targetId: id,
        after: { judged_by: admin.id, note: note ?? null },
        ip: meta.ip,
        ua: meta.ua,
      });
    } else if (action === "remove_coupon") {
      if (!report.coupon) throw new ApiError("VALIDATION_ERROR", { message: "此檢舉沒有對應票券" });
      await tx.coupon.update({ where: { id: report.coupon.id }, data: { status: "SUSPENDED" } });
      await tx.report.update({
        where: { id },
        data: { status: "RESOLVED", adminNote: note ?? null, resolvedAt: new Date() },
      });
      await notify(tx, {
        userId: report.coupon.ownerId,
        type: "REPORT_UPDATED",
        title: "你的票券已被下架",
        body: `「${report.coupon.title}」因違反平台規範已被下架${note ? `：${note}` : ""}。如有疑問請聯繫客服。`,
        referenceType: "coupon",
        referenceId: report.coupon.id,
      });
    } else if (action === "strike_user") {
      // 累積檢舉：a confirmed but not-severe violation. Record ONE strike against
      // the accountable user (named user, else the coupon owner). The listing
      // isn't pulled down here — re-list it if it was only auto-flagged REPORTED,
      // because the strike is on the person, not this one coupon. At
      // CONFIRMED_STRIKE_LIMIT strikes the account auto-suspends (after the tx,
      // mirroring the malicious-reporter path).
      if (!offenderId) throw new ApiError("VALIDATION_ERROR", { message: "此檢舉沒有對應使用者" });
      await tx.report.update({
        where: { id },
        data: { status: "RESOLVED", adminNote: note ?? null, resolvedAt: new Date() },
      });
      if (report.coupon && report.coupon.status === "REPORTED") {
        await tx.coupon.update({ where: { id: report.coupon.id }, data: { status: "AVAILABLE" } });
      }
      // Strike is keyed on the offender (actorId) so we can count their history.
      await writeAudit(tx, {
        actorId: offenderId,
        action: "report.confirmed_strike",
        targetType: "report",
        targetId: id,
        after: { judged_by: admin.id, note: note ?? null },
        ip: meta.ip,
        ua: meta.ua,
      });
    } else {
      // suspend_user
      const targetId = report.reportedUserId;
      if (!targetId) throw new ApiError("VALIDATION_ERROR", { message: "此檢舉沒有對應使用者" });
      await tx.user.update({ where: { id: targetId }, data: { status: "SUSPENDED" } });
      await tx.coupon.updateMany({
        where: { ownerId: targetId, status: { in: ["AVAILABLE", "PENDING", "REPORTED"] } },
        data: { status: "SUSPENDED" },
      });
      await tx.report.update({
        where: { id },
        data: { status: "RESOLVED", adminNote: note ?? null, resolvedAt: new Date() },
      });
      await notify(tx, {
        userId: targetId,
        type: "REPORT_UPDATED",
        title: "你的帳號已被暫停",
        body: `你的帳號因違反平台規範已被暫停，相關票券已下架${note ? `：${note}` : ""}。如有疑問可提出申訴。`,
      });
    }

    await writeAudit(tx, {
      actorId: admin.id,
      action: `report.${action}`,
      targetType: "report",
      targetId: id,
      after: { action, note: note ?? null },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  // A reporter judged malicious/false MALICIOUS_REPORT_LIMIT times gets
  // auto-suspended. Each strike is a distinct report an admin explicitly flagged,
  // so this can't be gamed by a single accuser.
  if (action === "dismiss_malicious") {
    const strikes = await prisma.auditLog.count({
      where: { actorId: report.reporterId, action: "report.malicious_strike" },
    });
    if (strikes >= MALICIOUS_REPORT_LIMIT) {
      const reporter = await prisma.user.findUnique({
        where: { id: report.reporterId },
        select: { status: true },
      });
      if (reporter?.status === "ACTIVE") {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: report.reporterId },
            data: { status: "SUSPENDED" },
          });
          await tx.coupon.updateMany({
            where: { ownerId: report.reporterId, status: { in: ["AVAILABLE", "PENDING", "REPORTED"] } },
            data: { status: "SUSPENDED" },
          });
          await notify(tx, {
            userId: report.reporterId,
            type: "REPORT_UPDATED",
            title: "你的帳號已因濫用檢舉被暫停",
            body: "你已累積多次被判定為惡意或不實的檢舉，帳號已暫停、相關票券已下架。如有疑問可提出申訴。",
          });
          await writeAudit(tx, {
            action: "user.suspend_malicious_reporter",
            targetType: "user",
            targetId: report.reporterId,
            after: { malicious_strikes: strikes },
          });
        });
      }
    }
  }

  // A reported user judged 成立 (confirmed) CONFIRMED_STRIKE_LIMIT times gets
  // auto-suspended. Each strike is a distinct report an admin explicitly confirmed.
  if (action === "strike_user" && offenderId) {
    const strikes = await prisma.auditLog.count({
      where: { actorId: offenderId, action: "report.confirmed_strike" },
    });
    if (strikes >= CONFIRMED_STRIKE_LIMIT) {
      const offender = await prisma.user.findUnique({
        where: { id: offenderId },
        select: { status: true },
      });
      if (offender?.status === "ACTIVE") {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: offenderId }, data: { status: "SUSPENDED" } });
          await tx.coupon.updateMany({
            where: { ownerId: offenderId, status: { in: ["AVAILABLE", "PENDING", "REPORTED"] } },
            data: { status: "SUSPENDED" },
          });
          await notify(tx, {
            userId: offenderId,
            type: "REPORT_UPDATED",
            title: "你的帳號已被暫停",
            body: "你已累積多次被判定成立的檢舉，帳號已暫停、相關票券已下架。如有疑問可提出申訴。",
          });
          await writeAudit(tx, {
            action: "user.suspend_confirmed_strikes",
            targetType: "user",
            targetId: offenderId,
            after: { confirmed_strikes: strikes },
          });
        });
      }
    }
  }

  return jsonOk({ id, action });
});
