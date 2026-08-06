import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runPurgeDeletedUsers } from "@/lib/cron-jobs";

// Enforces the retention limit promised in the privacy policy (§5.4): six months
// after an account is deleted, strip the identifying fields still held in its
// audit trail. Accounts with an unresolved dispute, report, appeal or legal hold
// are skipped (§5.5) — without that gate this job would quietly destroy evidence
// while a case is still open.
async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runPurgeDeletedUsers());
}

export const GET = route(run);
export const POST = route(run);
