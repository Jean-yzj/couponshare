import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

// Public headline numbers for the landing page. 60s in-memory cache so a viral
// landing (many visitors polling) can't hammer the DB — one query per minute.
let cache: { at: number; data: { shared: number; sent: number; members: number } } | null = null;
const TTL_MS = 60_000;

export const GET = route(async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return jsonOk(cache.data);
  const [shared, sent, members] = await Promise.all([
    prisma.auditLog.count({ where: { action: "coupon.publish" } }),
    prisma.coupon.count({ where: { status: "CLAIMED" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
  ]);
  const data = { shared, sent, members };
  cache = { at: Date.now(), data };
  return jsonOk(data);
});
