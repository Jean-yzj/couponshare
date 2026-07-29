import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { requireActiveUser, getCurrentUser } from "@/lib/auth";
import { throttle } from "@/lib/throttle";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Behavioural events the funnel reports are built from. Server-side allowlist:
// this endpoint accepts logged-out writes, so an open `name` field would let
// anyone fill the table with junk.
//
// Unknown names are dropped per-event instead of failing the batch — shipped app
// builds live in the wild for months, and an old build sending a name this
// server no longer knows must not take the rest of its batch down with it.
const EVENT_NAMES = new Set([
  "screen_view",
  "coupon_view",
  "coupon_apply_click",
  "coupon_apply_success",
  "coupon_publish_start",
  "coupon_publish_success",
  "guide_shown",
  "guide_done",
  "share_click",
  "push_open",
  "notification_open",
  "promo_impression",
  "promo_click",
]);

// Behaviour only — never email, barcode, or message text. The length caps are a
// backstop against a client accidentally passing something long and personal.
const propValue = z.union([z.string().max(200), z.number(), z.boolean()]);

const batchEvent = z.object({
  name: z.string().min(1).max(40),
  props: z
    .record(z.string().max(40), propValue)
    .refine((p) => Object.keys(p).length <= 20, { message: "too many prop keys" })
    .optional(),
  // Device-scoped id from the app's SecureStore; stitches pre-/post-login
  // activity for one device. Capped because it is used in a rate-limit key.
  anon_id: z.string().max(64).optional(),
  platform: z.enum(["ios", "android", "web"]),
  app_build: z.number().int().nonnegative().max(1_000_000).optional(),
});

// Two shapes on one endpoint:
//   { type: "guide_shown" }  — the original web call (components/ShareGuideCard)
//   { events: [...] }        — batched client events (app, and web later)
const bodySchema = z.union([
  z.object({ type: z.enum(["guide_shown"]) }),
  z.object({ events: z.array(batchEvent).min(1).max(20) }),
]);

// POST /api/v1/events — client-side behavioural events (埋點), fire-and-forget.
export const POST = route(async (req) => {
  // Coarse per-IP backstop, applied before parsing so an unauthenticated flood
  // can't reach the validator. Deliberately generous: the per-device limit below
  // is the real brake, because carrier CGNAT puts many real users on one IP.
  throttle(req, "client-events-ip", 2000, 60 * 60_000);

  const body = await readBody(req, bodySchema);

  if ("type" in body) {
    // Legacy single-event path. Behaviour deliberately unchanged: still requires
    // an active user, still 10/hour, still one audit row per actor ever.
    const user = await requireActiveUser();
    throttle(req, "client-event", 10, 60 * 60_000);

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
    return jsonOk({ ok: true });
  }

  // Batch path. Intentionally works logged-out: coupon detail is browsable
  // without an account, so gating this on auth would silently discard exactly
  // the top of the funnel these events exist to measure.
  const device = body.events[0]?.anon_id;
  if (device) throttle(req, `client-events-device:${device}`, 200, 60 * 60_000);

  const user = await getCurrentUser();
  const meta = clientMeta(req);

  const rows = body.events
    .filter((e) => EVENT_NAMES.has(e.name))
    .map((e) => ({
      name: e.name,
      props: e.props,
      anonId: e.anon_id ?? null,
      userId: user?.id ?? null,
      platform: e.platform,
      appBuild: e.app_build ?? null,
      ipAddress: meta.ip,
    }));

  if (rows.length > 0) await prisma.clientEvent.createMany({ data: rows });

  // Counts come back so a client can tell "server stored it" from "server
  // dropped it" — the old contract returned a bare ok, which is part of why the
  // mismatch went unnoticed for weeks.
  return jsonOk({ ok: true, accepted: rows.length, dropped: body.events.length - rows.length });
});
