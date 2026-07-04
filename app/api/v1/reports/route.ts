import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { reportSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";
import { validateDataUriImage } from "@/lib/image";

const COUPON_REPORT_THRESHOLD = 3; // distinct-ish reports flag a coupon
const USER_SUSPEND_THRESHOLD = 3; // 3 distinct reporters suspend the account

export const POST = route(async (req) => {
  throttle(req, "report", 20, 60 * 60_000);
  const user = await requireActiveUser();
  const body = await readBody(req, reportSchema);
  // Accept a data-URI screenshot (or an http URL passes through untouched).
  const evidenceImageUrl = body.evidence_image_url?.startsWith("data:")
    ? validateDataUriImage(body.evidence_image_url)
    : (body.evidence_image_url ?? null);

  if (!body.coupon_id && !body.transaction_id && !body.reported_user_id) {
    throw new ApiError("VALIDATION_ERROR", { message: "檢舉必須指定票券、交易或使用者" });
  }

  let coupon = null;
  if (body.coupon_id) {
    coupon = await prisma.coupon.findUnique({ where: { id: body.coupon_id } });
    if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  }

  // The account being reported (coupon owner, or an explicit user).
  const reportedUserId = body.reported_user_id ?? coupon?.ownerId ?? null;
  if (reportedUserId && reportedUserId === user.id) {
    throw new ApiError("VALIDATION_ERROR", { message: "不能檢舉自己" });
  }

  try {
    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        couponId: body.coupon_id ?? null,
        transactionId: body.transaction_id ?? null,
        reportedUserId,
        reason: body.reason,
        description: body.description ?? null,
        evidenceImageUrl,
        status: "PENDING",
      },
    });

    // Coupon-level: 3 distinct reporters (one report per user) AUTO-DELIST the
    // coupon — no admin review, so offensive / junk listings vanish fast even when
    // the admin isn't watching. Owner is notified and can appeal.
    if (body.coupon_id && coupon) {
      const updated = await prisma.coupon.update({
        where: { id: body.coupon_id },
        data: { reportCount: { increment: 1 } },
      });
      if (
        updated.reportCount >= COUPON_REPORT_THRESHOLD &&
        ["AVAILABLE", "PENDING", "REPORTED"].includes(updated.status)
      ) {
        await prisma.coupon.update({ where: { id: body.coupon_id }, data: { status: "SUSPENDED" } });
        await notify(prisma, {
          userId: updated.ownerId,
          type: "REPORT_UPDATED",
          title: "你的票券已被自動下架",
          body: `「${updated.title}」因被多位使用者檢舉，已自動下架。如有疑問可提出申訴。`,
          referenceType: "coupon",
          referenceId: updated.id,
        });
        await writeAudit(prisma, {
          action: "coupon.auto_suspend_reported",
          targetType: "coupon",
          targetId: updated.id,
          after: { report_count: updated.reportCount },
        });
      }
    }

    // Account-level: 3+ DISTINCT reporters → auto-suspend the account.
    let userSuspended = false;
    if (reportedUserId) {
      // Only count reporters whose account is at least 24h old. This blocks the
      // throwaway-account brigade where one attacker registers 3 fresh accounts to
      // auto-suspend an innocent user. Every report is still recorded for admins.
      const establishedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const reporters = await prisma.report.findMany({
        where: {
          reportedUserId,
          status: { notIn: ["REJECTED", "RESOLVED"] },
          reporter: { createdAt: { lt: establishedBefore } },
        },
        select: { reporterId: true },
        distinct: ["reporterId"],
      });
      if (reporters.length >= USER_SUSPEND_THRESHOLD) {
        const target = await prisma.user.findUnique({
          where: { id: reportedUserId },
          select: { status: true },
        });
        if (target && target.status === "ACTIVE") {
          await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: reportedUserId }, data: { status: "SUSPENDED" } });
            await tx.coupon.updateMany({
              where: { ownerId: reportedUserId, status: { in: ["AVAILABLE", "PENDING"] } },
              data: { status: "SUSPENDED" },
            });
            await notify(tx, {
              userId: reportedUserId,
              type: "REPORT_UPDATED",
              title: "你的帳號已被暫停",
              body: "你的帳號因多次被檢舉而暫停，相關票券已下架。如有疑問請聯繫客服。",
            });
            await writeAudit(tx, {
              action: "user.auto_suspend",
              targetType: "user",
              targetId: reportedUserId,
              after: { reason: "reported_by_3_or_more", distinct_reporters: reporters.length },
            });
          });
          userSuspended = true;
        }
      }
    }

    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "report.create",
      targetType: "report",
      targetId: report.id,
      after: { reason: body.reason, coupon_id: body.coupon_id ?? null, reported_user_id: reportedUserId },
      ip: meta.ip,
      ua: meta.ua,
    });

    return jsonOk({ report_id: report.id, status: report.status, user_suspended: userSuspended }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("REPORT_ALREADY_EXISTS");
    }
    throw e;
  }
});
