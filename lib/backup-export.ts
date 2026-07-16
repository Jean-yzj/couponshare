import { prisma } from "@/lib/db";

// Tables to include in a full logical backup, in stable index order.
// Batch sizes are tuned to barcode/image blob sizes in each model.
// NOTE: passwordReset is intentionally excluded — it contains short-lived
// secrets whose inclusion in a backup creates more risk than value; restoring
// stale rows could re-expose expired tokens.
export const TABLES: { model: string; batch: number }[] = [
  { model: "user", batch: 500 },
  { model: "coupon", batch: 1 },
  { model: "claimRequest", batch: 300 },
  { model: "transaction", batch: 50 },
  { model: "transactionMessage", batch: 500 },
  { model: "rating", batch: 500 },
  { model: "report", batch: 300 },
  { model: "appeal", batch: 500 },
  // Evidence data-URIs can be ~0.5MB each, so keep the batch small like coupon.
  { model: "socialPost", batch: 20 },
  { model: "scoreLedger", batch: 1000 },
  { model: "notification", batch: 1000 },
  { model: "brandFollow", batch: 1000 },
  { model: "pushToken", batch: 1000 },
  { model: "block", batch: 1000 },
  { model: "auditLog", batch: 1000 },
  // Enterprise / brand tables — appended at tail so existing resume cursors stay valid.
  { model: "brand", batch: 300 },
  // imageUrl can be up to ~700KB data-URI, so use a small batch.
  { model: "brandCoupon", batch: 20 },
  { model: "brandCouponApplication", batch: 500 },
  { model: "businessLead", batch: 300 },
  { model: "dailyActive", batch: 1000 },
];

// Stop a request after roughly this many uncompressed bytes, then hand the client
// a resume cursor. Sized so even a slow SG↔TW link finishes each request in a few
// minutes — well under the gateway timeout — regardless of total DB size.
export const BYTE_BUDGET = 40 * 1024 * 1024;

// Full logical backup as gzipped NDJSON. Each line is {"_t":<model>,"r":<row>}.
// Restore with a matching importer (which ignores non-model markers like
// _meta/_next/_done).
//
// RESUMABLE: emit at most BYTE_BUDGET uncompressed bytes, then yield a
// {"_t":"_next","after":"<tableIdx>:<id>"} marker. Caller re-requests with
// ?after=<token> until it sees {"_t":"_done"}. Concatenated gzip members form
// one valid file. Without ?after it starts from the beginning.
//
// Memory-safe: id-cursor pagination + caller-controlled backpressure (pull).
// coupon and brandCoupon rows with large blobs are emitted one at a time.
// `byteBudget` caps uncompressed bytes per call (default BYTE_BUDGET for the
// resumable HTTP path). Pass Infinity to stream the whole dump in one call —
// used by the cron path, where there is no gateway timeout to respect.
export async function* generate(
  startIdx: number,
  startId: string | undefined,
  byteBudget: number = BYTE_BUDGET,
): AsyncGenerator<string> {
  if (startIdx === 0 && !startId) {
    yield JSON.stringify({ _t: "_meta", exportedAt: new Date().toISOString(), version: 1 }) + "\n";
  }
  let bytes = 0;
  for (let ti = startIdx; ti < TABLES.length; ti++) {
    const t = TABLES[ti];
    let cursor = ti === startIdx ? startId : undefined;
    for (;;) {
      const rows: { id: string }[] = await (
        prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<{ id: string }[]> }>
      )[t.model].findMany({
        take: t.batch,
        orderBy: { id: "asc" },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (rows.length === 0) break;
      let chunk = "";
      for (const r of rows) chunk += JSON.stringify({ _t: t.model, r }) + "\n";
      yield chunk;
      bytes += chunk.length;
      cursor = rows[rows.length - 1].id;
      if (rows.length < t.batch) break; // table exhausted
      if (bytes >= byteBudget) {
        // Pause mid-table; resume this same table after `cursor` next request.
        yield JSON.stringify({ _t: "_next", after: `${ti}:${cursor}` }) + "\n";
        return;
      }
    }
    // Table finished. If we're over budget and more tables remain, pause here.
    if (bytes >= byteBudget && ti < TABLES.length - 1) {
      yield JSON.stringify({ _t: "_next", after: `${ti + 1}:` }) + "\n";
      return;
    }
  }

  // Small operational tables whose PK isn't `id`, so they don't fit the id-cursor
  // loop above (AppSetting keyed by `key`, BlockedIp by `ip`). They're tiny — the
  // kill-switch flags and a short IP blocklist — so emit them whole here on the
  // final segment (this code is only reached once the paged loop fully completes).
  for (const model of ["appSetting", "blockedIp"] as const) {
    const rows: Record<string, unknown>[] = await (
      prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<Record<string, unknown>[]> }>
    )[model].findMany({});
    let chunk = "";
    for (const r of rows) chunk += JSON.stringify({ _t: model, r }) + "\n";
    if (chunk) yield chunk;
  }

  yield JSON.stringify({ _t: "_done" }) + "\n";
}
