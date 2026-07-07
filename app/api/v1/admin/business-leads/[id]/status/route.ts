import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { businessLeadStatusSchema } from "@/lib/validation";

// Admin: mark a lead as quoted (CONTACTED) or back to PENDING.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { status } = await readBody(req, businessLeadStatusSchema);

  const lead = await prisma.businessLead.findUnique({ where: { id } });
  if (!lead) throw new ApiError("NOT_FOUND");

  const updated = await prisma.businessLead.update({
    where: { id },
    data: { status, contactedAt: status === "CONTACTED" ? new Date() : null },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.business_lead.status",
    targetType: "business_lead",
    targetId: id,
    before: { status: lead.status },
    after: { status: updated.status },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id: updated.id, status: updated.status, contacted_at: updated.contactedAt });
});
