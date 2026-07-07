import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { businessLeadSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";
import { throttle } from "@/lib/throttle";

export const runtime = "nodejs";

// 企業合作窗口 — PUBLIC (business owners usually have no platform account).
// Stores the lead, then pings every admin in-app; the admin follows up by
// emailing a quote. Abuse surface is only a 4-field text row, so an IP throttle
// plus zod limits is enough.
export const POST = route(async (req) => {
  throttle(req, "business-lead", 5, 60 * 60_000);
  const body = await readBody(req, businessLeadSchema);

  const lead = await prisma.businessLead.create({
    data: {
      name: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone,
      lineId: body.line_id,
    },
    select: { id: true, name: true, email: true },
  });

  // Notify admins (ADMIN_EMAILS env, comma-separated). Best-effort: the lead is
  // already saved, so a notify hiccup must not turn into a 500 that makes the
  // business owner resubmit.
  try {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.length > 0) {
      const admins = await prisma.user.findMany({
        where: {
          OR: adminEmails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })),
        },
        select: { id: true },
      });
      for (const admin of admins) {
        await notify(prisma, {
          userId: admin.id,
          type: "BUSINESS_LEAD_RECEIVED",
          title: "新的企業合作洽詢",
          body: `${lead.name}（${lead.email}）填寫了企業合作窗口，記得寄報價給他。`,
          referenceType: "business_lead",
          referenceId: lead.id,
        });
      }
    }
  } catch (e) {
    console.error("business-lead notify failed", e);
  }

  return jsonOk({ id: lead.id }, 201);
});
