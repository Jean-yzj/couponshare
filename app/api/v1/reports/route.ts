import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { canTransition } from "@/lib/coupon-state";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { reportSchema } from "@/lib/validation";

const COUPON_REPORT_THRESHOLD = 3; // distinct-ish reports flag a coupon
const USER_SUSPEND_THRESHOLD = 3; // 3 distinct reporters suspend the account

export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const body = await readBody(req, reportSchema);

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
        evidenceImageUrl: body.evidence_image_url ?? null,
        status: "PENDING",
      },
    });

    // Coupon-level: flag the coupon once enough reports land.
    if (body.coupon_id && coupon) {
      const updated = await prisma.coupon.update({
        where: { id: body.coupon_id },
        data: { reportCount: { increment: 1 } },
      });
      if (updated.reportCount >= COUPON_REPORT_THRESHOLD && canTransition(updated.status, "REPORTED")) {
        await prisma.coupon.update({ where: { id: body.coupon_id }, data: { status: "REPORTED" } });
      }
    }

    // Account-level: 3+ DISTINCT reporters → auto-suspend the account.
    let userSuspended = false;
    if (reportedUserId) {
      const reporters = await prisma.report.findMany({
        where: { reportedUserId },
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
