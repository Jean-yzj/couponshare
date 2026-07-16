import type { NextRequest } from "next/server";
import { TABLES, BYTE_BUDGET, generate } from "@/lib/backup-export";

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

export async function GET(req: NextRequest) {
  // A full-DB export is gated on its OWN dedicated high-entropy secret only — never
  // the lower-scope cron secret, so leaking CRON_SECRET can't turn into a database
  // dump. Fail closed if BACKUP_SECRET isn't set.
  const bk = process.env.BACKUP_SECRET;
  const okBackup = !!bk && req.headers.get("x-backup-secret") === bk;
  if (!okBackup) {
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

// Re-export BYTE_BUDGET so any tooling that imports this route still compiles.
export { BYTE_BUDGET };
