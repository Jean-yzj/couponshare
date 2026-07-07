import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

// Admin: list business-cooperation leads, newest first, optional ?status= filter.
export const GET = route(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const where: Prisma.BusinessLeadWhereInput = {};
  if (status === "PENDING" || status === "CONTACTED") where.status = status;

  const leads = await prisma.businessLead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return jsonOk({
    data: leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      line_id: l.lineId,
      status: l.status,
      created_at: l.createdAt,
      contacted_at: l.contactedAt,
    })),
  });
});
