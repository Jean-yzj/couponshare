import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { clientIp } from "./ip";

// Fixed-window, in-memory rate limiter. Single-instance only: state lives in the
// process and resets on redeploy. That's a deliberate trade-off — it's a real
// brake on brute-force / spam from one IP without adding a Redis dependency. For
// multi-instance scale, swap the Map for Upstash/Redis behind the same signature.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function ipOf(req: NextRequest): string {
  return clientIp(req) || "unknown";
}

export function throttle(req: NextRequest, action: string, limit: number, windowMs: number): void {
  const now = Date.now();
  // Opportunistic cleanup so the Map can't grow unbounded.
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const key = `${action}:${ipOf(req)}`;
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) {
    throw new ApiError("RATE_LIMITED", { retry_after_seconds: Math.ceil((b.resetAt - now) / 1000) });
  }
}
