import type { NextRequest } from "next/server";
import { ApiError } from "./errors";

// Cron endpoints are guarded by a shared secret (header or query). If CRON_SECRET
// is unset the guard is a no-op (handy for local dev).
export function assertCron(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed in production: an unset secret must not leave cron endpoints open
    // to anyone (mass-expire/revert coupons, notification spam).
    if (process.env.NODE_ENV === "production") throw new ApiError("UNAUTHORIZED");
    return; // local dev convenience
  }
  // Header only — query strings leak into proxy/access logs and Referer headers.
  const provided = req.headers.get("x-cron-secret");
  if (provided !== secret) throw new ApiError("UNAUTHORIZED");
}
