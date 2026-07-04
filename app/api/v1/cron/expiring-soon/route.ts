import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runExpiringSoon } from "@/lib/cron-jobs";

async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runExpiringSoon());
}

export const GET = route(run);
export const POST = route(run);
