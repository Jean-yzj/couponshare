import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { canTransition } from "@/lib/coupon-state";
import { writeAudit } from "@/lib/audit";
import { reportSchema } from "@/lib/validation";

const REPORT_THRESHOLD = 3;

export const POST = route(async (req) => {
  const user = await requireActiveUser();
  const body = await readBody(req, reportSchema);

  if (!body.coupon_id && !body.transaction_id && !body.reported_user_id) {
    throw new ApiError("VALIDATION_ERROR", { message: "檢舉必須指定票券、交易或使用者" });
  }

  if (body.coupon_id) {
    const exists = await prisma.coupon.findUnique({ where: { id: body.coupon_id } });
    if (!exists) throw new ApiError("COUPON_NOT_FOUND");
  }

  try {
    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        couponId: body.coupon_id ?? null,
        transactionId: body.transaction_id ?? null,
        reportedUserId: body.reported_user_id ?? null,
        reason: body.reason,
        description: body.description ?? null,
        evidenceImageUrl: body.evidence_image_url ?? null,
        status: "PENDING",
      },
    });

    // Bump the coupon's report count; auto-flag once the threshold is hit.
    if (body.coupon_id) {
      const updated = await prisma.coupon.update({
        where: { id: body.coupon_id },
        data: { reportCount: { increment: 1 } },
      });
      if (updated.reportCount >= REPORT_THRESHOLD && canTransition(updated.status, "REPORTED")) {
        await prisma.coupon.update({ where: { id: body.coupon_id }, data: { status: "REPORTED" } });
      }
    }

    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "report.create",
      targetType: "report",
      targetId: report.id,
      after: { reason: body.reason, coupon_id: body.coupon_id ?? null },
      ip: meta.ip,
      ua: meta.ua,
    });

    return jsonOk({ report_id: report.id, status: report.status }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("REPORT_ALREADY_EXISTS");
    }
    throw e;
  }
});
