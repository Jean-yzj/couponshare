import type { NextRequest } from "next/server";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runAutoCompleteGifts } from "@/lib/cron-jobs";

// Closes GIFT transactions that nobody disputed for a week. The confirm button
// serves the platform's bookkeeping, not the two people involved, so 59% of all
// transactions never got pressed and the completion metric measured button-
// pressing rather than giving. Accepts ?limit= so the historical backlog can be
// drained through the same code path the scheduler uses.
async function run(req: NextRequest) {
  assertCron(req);
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1000) : undefined;
  return jsonOk(await runAutoCompleteGifts(limit));
}

export const GET = route(run);
export const POST = route(run);
