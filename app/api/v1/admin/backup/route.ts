import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

// Full logical backup as gzipped NDJSON, streamed over HTTP — the only channel
// on this host that can move the ~486MB DB (exec can't bulk-transfer, no S3, the
// pg container has no curl). Each line is {"_t":<model>,"r":<row>}. Restore with
// a matching importer. Gated by the cron secret (x-cron-secret header).
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

async function* generate(): AsyncGenerator<string> {
  yield JSON.stringify({ _t: "_meta", exportedAt: new Date().toISOString(), version: 1 }) + "\n";
  for (const t of TABLES) {
    let cursor: string | undefined;
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
      cursor = rows[rows.length - 1].id;
      if (rows.length < t.batch) break;
    }
  }
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

  const enc = new TextEncoder();
  const gen = generate();
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
