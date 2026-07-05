import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { requireActiveUser } from "@/lib/auth";
import { throttle } from "@/lib/throttle";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  type: z.enum(["guide_shown"]),
});

// POST /api/v1/events — fire-and-forget client-side events (埋點).
// Currently only supports guide_shown. One audit log per actor, ever.
export const POST = route(async (req) => {
  const user = await requireActiveUser();
  // 10 calls per user per hour (keyed by IP; matches the spirit of the other throttles).
  throttle(req, "client-event", 10, 60 * 60_000);

  const body = await readBody(req, bodySchema);

  if (body.type === "guide_shown") {
    // Idempotent: only write audit once per actor, ever.
    const existing = await prisma.auditLog.findFirst({
      where: { actorId: user.id, action: "guide.shown" },
      select: { id: true },
    });
    if (existing) return jsonOk({ ok: true });

    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "guide.shown",
      targetType: "user",
      targetId: user.id,
      ip: meta.ip,
      ua: meta.ua,
    });
  }

  return jsonOk({ ok: true });
});
