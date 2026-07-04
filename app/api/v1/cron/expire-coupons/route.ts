import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runExpireCoupons } from "@/lib/cron-jobs";

// Expire coupons + auto-delist no-interest ones. Runs on the in-process scheduler
// (lib/scheduler.ts); this endpoint stays for manual / external triggering.
async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runExpireCoupons());
}

export const GET = route(run);
export const POST = route(run);
