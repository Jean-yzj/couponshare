import { prisma } from "./db";

// In-memory cache of the current top-3 contributors → rank (1..3), so a "第N名"
// badge can follow their name wherever it's shown. Routes that render names call
// the awaited ensureRanks() once before serializing; publicUser then reads the
// fresh map synchronously via topRank(). TTL keeps it cheap; awaiting the refresh
// (rather than fire-and-forget) means the badge is correct on the very first
// request and after any instance cold-start.
let cache: { at: number; map: Map<string, number> } = { at: 0, map: new Map() };
let inflight: Promise<void> | null = null;
const TTL_MS = 3 * 60 * 1000;

function nowMs(): number {
  return new Date().getTime();
}

async function doRefresh(): Promise<void> {
  const rows = await prisma.user.findMany({
    where: { status: "ACTIVE", contributionScore: { gt: 0 } },
    orderBy: [{ contributionScore: "desc" }, { createdAt: "asc" }],
    take: 3,
    select: { id: true },
  });
  const map = new Map<string, number>();
  rows.forEach((r, i) => map.set(r.id, i + 1));
  cache = { at: nowMs(), map };
}

// Refresh the top-3 cache if stale. Cheap no-op when fresh. Safe to call often;
// concurrent callers share one in-flight refresh.
export async function ensureRanks(): Promise<void> {
  if (nowMs() - cache.at <= TTL_MS) return;
  if (!inflight) {
    inflight = doRefresh()
      .catch(() => {
        /* keep the stale map; retry next call */
      })
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
}

// Rank (1-3) for a user id, or null. Reads the cache filled by ensureRanks().
export function topRank(userId: string): number | null {
  return cache.map.get(userId) ?? null;
}
