import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runCloseAbandonedListings } from "@/lib/cron-jobs";

// Takes down listings whose owner never answered a single application. The feed
// was 60% two-month-old coupons with 2,102 applications waiting on them — the
// shelf looked full while almost nothing on it could actually be obtained.
async function run(req: NextRequest) {
  assertCron(req);
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 500) : undefined;
  return jsonOk(await runCloseAbandonedListings(limit));
}

export const GET = route(run);
export const POST = route(run);
