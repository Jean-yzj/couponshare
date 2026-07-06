import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";

type Db = PrismaClient | Prisma.TransactionClient;

// The blocked-IP set is small and read on the registration path — cache it so we
// don't hit the DB on every signup attempt.
const CACHE_MS = 30_000;
let cache = new Set<string>();
let cachedAt = 0;

export async function isIpBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const now = Date.now();
  if (!cachedAt || now - cachedAt >= CACHE_MS) {
    try {
      const rows = await prisma.blockedIp.findMany({ select: { ip: true } });
      cache = new Set(rows.map((r) => r.ip));
      cachedAt = now;
    } catch {
      return false; // fail open — never lock signups out on a settings read error
    }
  }
  return cache.has(ip);
}

// On admin suspension, block the IPs the account was recently active from (read off
// the audit log) so the person can't just register a fresh account from the same
// connection. Capped at 5 IPs to limit collateral on shared / CGNAT addresses.
export async function blockUserRecentIps(db: Db, userId: string, reason: string): Promise<number> {
  const rows = await db.auditLog.findMany({
    where: { actorId: userId, ipAddress: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { ipAddress: true },
  });
  const ips = Array.from(
    new Set(rows.map((r) => r.ipAddress).filter((x): x is string => !!x)),
  ).slice(0, 5);
  for (const ip of ips) {
    await db.blockedIp.upsert({ where: { ip }, create: { ip, userId, reason }, update: {} });
  }
  cachedAt = 0; // bust cache so the block takes effect immediately on this instance
  return ips.length;
}
