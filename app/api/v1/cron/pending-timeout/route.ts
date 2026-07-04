import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runPendingTimeout } from "@/lib/cron-jobs";

async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runPendingTimeout());
}

export const GET = route(run);
export const POST = route(run);
