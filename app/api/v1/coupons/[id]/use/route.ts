import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// Claimant marks their received coupon as used — or un-marks it. This moves the
// coupon between the wallet's "我領取的" and "已使用" tabs. The coupon stays CLAIMED;
// usedAt is the only field touched. Only the claimant of a CLAIMED coupon may call it.
// Body: { used?: boolean } — omitted defaults to marking used (true).
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, claimantId: true, status: true, usedAt: true },
  });
  if (!coupon) throw new ApiError("NOT_FOUND");
  if (coupon.claimantId !== user.id) throw new ApiError("FORBIDDEN");
  if (coupon.status !== "CLAIMED") {
    throw new ApiError("VALIDATION_ERROR", { message: "只有已領取的票券可以標記使用狀態" });
  }

  let used = true;
  try {
    const body = await req.json();
    if (body && typeof body.used === "boolean") used = body.used;
  } catch {
    // No/invalid body → default to marking used.
  }

  const usedAt = used ? new Date() : null;
  await prisma.coupon.update({ where: { id }, data: { usedAt } });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: used ? "coupon.mark_used" : "coupon.unmark_used",
    targetType: "coupon",
    targetId: id,
    before: { usedAt: coupon.usedAt },
    after: { usedAt },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ coupon_id: id, used, used_at: usedAt });
});
