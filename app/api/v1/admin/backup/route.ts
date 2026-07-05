import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

// Full logical backup as gzipped NDJSON, streamed over HTTP — the only channel
// on this host that can move the ~486MB DB (exec can't bulk-transfer, no S3, the
// pg container has no curl). Each line is {"_t":<model>,"r":<row>}. Restore with
// a matching importer (which ignores non-model markers like _meta/_next/_done).
//
// RESUMABLE: a single request can't move the whole DB before Zeabur's ~10-min
// gateway timeout, so each request emits at most BYTE_BUDGET of data, then a
// {"_t":"_next","after":"<tableIdx>:<id>"} marker. The client re-requests with
// ?after=<token> until it sees {"_t":"_done"}. Concatenated gzip members form one
// valid file. Without ?after it starts from the beginning (backward compatible).
//
// Memory-safe: id-cursor pagination + backpressure via pull(), and coupons are
// emitted one row at a time because a barcode blob can be ~6.7MB.
const TABLES: { model: string; batch: number }[] = [
  { model: "user", batch: 500 },
  { model: "coupon", batch: 1 },
  { model: "claimRequest", batch: 300 },
  { model: "transaction", batch: 50 },
  { model: "transactionMessage", batch: 500 },
  { model: "rating", batch: 500 },
  { model: "report", batch: 300 },
  { model: "appeal", batch: 500 },
  { model: "scoreLedger", batch: 1000 },
  { model: "notification", batch: 1000 },
  { model: "brandFollow", batch: 1000 },
  { model: "pushToken", batch: 1000 },
  { model: "block", batch: 1000 },
  { model: "auditLog", batch: 1000 },
];

// Stop a request after roughly this many uncompressed bytes, then hand the client
// a resume cursor. Sized so even a slow SG↔TW link finishes each request in a few
// minutes — well under the gateway timeout — regardless of total DB size.
const BYTE_BUDGET = 40 * 1024 * 1024;

async function* generate(startIdx: number, startId: string | undefined): AsyncGenerator<string> {
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
      if (bytes >= BYTE_BUDGET) {
        // Pause mid-table; resume this same table after `cursor` next request.
        yield JSON.stringify({ _t: "_next", after: `${ti}:${cursor}` }) + "\n";
        return;
      }
    }
    // Table finished. If we're over budget and more tables remain, pause here.
    if (bytes >= BYTE_BUDGET && ti < TABLES.length - 1) {
      yield JSON.stringify({ _t: "_next", after: `${ti + 1}:` }) + "\n";
      return;
    }
  }
  yield JSON.stringify({ _t: "_done" }) + "\n";
}

export async function GET(req: NextRequest) {
  // Dedicated BACKUP_SECRET (x-backup-secret) so a full-DB download isn't tied to
  // the cron secret. Still accepts the cron secret during the transition; drop
  // that once BACKUP_SECRET is set everywhere. Fail closed if neither is set.
  const bk = process.env.BACKUP_SECRET;
  const cs = process.env.CRON_SECRET;
  const okBackup = !!bk && req.headers.get("x-backup-secret") === bk;
  const okCron = !!cs && req.headers.get("x-cron-secret") === cs;
  if (!okBackup && !okCron) {
    return new Response("unauthorized\n", { status: 401 });
  }

  // Resume cursor: "<tableIdx>:<id>" (id may be empty to start a table fresh).
  const after = new URL(req.url).searchParams.get("after") ?? "";
  let startIdx = 0;
  let startId: string | undefined;
  if (after) {
    const sep = after.indexOf(":");
    const idxPart = sep === -1 ? after : after.slice(0, sep);
    const idPart = sep === -1 ? "" : after.slice(sep + 1);
    const parsed = Number.parseInt(idxPart, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < TABLES.length) startIdx = parsed;
    startId = idPart || undefined;
  }

  const enc = new TextEncoder();
  const gen = generate(startIdx, startId);
  const ndjson = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(enc.encode(value));
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const gz = ndjson.pipeThrough(
    new CompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );
  return new Response(gz, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="couponshare-backup.ndjson.gz"',
      "Cache-Control": "no-store",
    },
  });
}
