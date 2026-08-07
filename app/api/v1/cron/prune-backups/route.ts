import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runPruneBackups } from "@/lib/cron-jobs";

// Applies a retention window to the daily R2 dumps. Without one they accumulate
// forever — 30GB by 2026-08 — and every copy carries every user's email and
// password hash, so age is a liability, not just cost.
async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runPruneBackups());
}

export const GET = route(run);
export const POST = route(run);
