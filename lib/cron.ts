import type { NextRequest } from "next/server";
import { ApiError } from "./errors";

// Cron endpoints are guarded by a shared secret (header or query). If CRON_SECRET
// is unset the guard is a no-op (handy for local dev).
export function assertCron(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const provided =
    req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (provided !== secret) throw new ApiError("UNAUTHORIZED");
}
