import { prisma } from "./db";

// Small in-memory cache of the current top-3 contributors → rank (1..3). Read
// synchronously from serialize (publicUser) so the "第N名" badge can be attached
// wherever a name is shown; refreshed lazily in the background when stale so we
// never block a response on this cosmetic lookup. Single long-lived Node process
// on Zeabur, so the module cache persists across requests.
let cache: { at: number; map: Map<string, number> } = { at: 0, map: new Map() };
let inflight: Promise<void> | null = null;
const TTL_MS = 3 * 60 * 1000;

function refresh(): void {
  if (inflight) return;
  inflight = prisma.user
    .findMany({
      where: { status: "ACTIVE", contributionScore: { gt: 0 } },
      orderBy: [{ contributionScore: "desc" }, { createdAt: "asc" }],
      take: 3,
      select: { id: true },
    })
    .then((rows) => {
      const map = new Map<string, number>();
      rows.forEach((r, i) => map.set(r.id, i + 1));
      cache = { at: nowMs(), map };
    })
    .catch(() => {
      /* keep the stale map; retry on the next call */
    })
    .finally(() => {
      inflight = null;
    });
}

function nowMs(): number {
  return new Date().getTime();
}

// Rank (1-3) for a user id, or null. Kicks off a background refresh when stale.
export function topRank(userId: string): number | null {
  if (nowMs() - cache.at > TTL_MS) refresh();
  return cache.map.get(userId) ?? null;
}
