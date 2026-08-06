import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runDedupeBarcodes } from "@/lib/cron-jobs";

// Drops the database copy of a barcode once the R2 object is confirmed to exist
// with a matching checksum. The upload path deliberately writes both copies (an
// R2 outage must not fail an upload), so without this sweep every coupon keeps a
// duplicate forever — that is what grew the coupons table to 3.2GB before.
async function run(req: NextRequest) {
  assertCron(req);
  return jsonOk(await runDedupeBarcodes());
}

export const GET = route(run);
export const POST = route(run);
