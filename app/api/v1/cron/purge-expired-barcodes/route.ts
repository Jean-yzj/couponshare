import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runPurgeExpiredBarcodes } from "@/lib/cron-jobs";

// Deletes barcodes of coupons that expired or were cancelled over a month ago:
// they can no longer be redeemed, so keeping the most sensitive field we store
// buys nothing. Coupons under dispute or an open report are skipped as evidence.
async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runPurgeExpiredBarcodes());
}

export const GET = route(run);
export const POST = route(run);
