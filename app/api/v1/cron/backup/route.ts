import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { NextRequest } from "next/server";
import { Upload } from "@aws-sdk/lib-storage";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { assertCron } from "@/lib/cron";
import { getR2ClientAndBucket } from "@/lib/barcode-storage";
import { generate, TABLES } from "@/lib/backup-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prefix for all daily backup objects in R2.
const BACKUP_PREFIX = "backups/";
// Regex for keys we manage. Any key outside this pattern is left untouched.
const BACKUP_KEY_RE = /^backups\/db-\d{4}-\d{2}-\d{2}\.ndjson\.gz$/;
// Staging keys left behind by crashed runs — cleaned up during retention.
const TMP_KEY_RE = /^backups\/db-\d{4}-\d{2}-\d{2}\.ndjson\.gz\.tmp$/;
// Maximum number of daily backups to retain (regardless of age).
const KEEP_MINIMUM = 7;
// Delete backups older than this many days (but always keep the newest KEEP_MINIMUM).
const MAX_AGE_DAYS = 30;

// Module-level lock: prevents concurrent backup runs in the same process instance.
let running = false;

// Return the current date formatted as YYYY-MM-DD in Asia/Taipei.
function taipeiDateString(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());
}

// Fire-and-forget: stream the full DB dump into R2 via multipart upload.
// Errors are caught and logged — the HTTP response has already been sent.
async function runBackup(key: string): Promise<void> {
  const t0 = Date.now();
  const r2 = getR2ClientAndBucket();
  if (!r2) {
    console.error("[backup-cron] R2 not configured — aborting background run");
    running = false;
    return;
  }
  const { client, bucket } = r2;

  // Stage to a .tmp key; only a dump that ended with the _done marker gets
  // promoted to `key`. The idempotency HeadObject in GET checks `key`, so a
  // truncated or failed run can never satisfy tomorrow's (or a retry's) check.
  const tmpKey = `${key}.tmp`;
  const gz = createGzip();

  try {
    // Infinity budget: the resumable 40MB cap is for the admin HTTP download;
    // stopping there would truncate the cron dump at the _next marker.
    const gen = generate(0, undefined, Infinity);
    let sawDone = false;
    // Convert the async generator to a Node.js Readable so lib-storage can consume it.
    const ndjsonReadable = Readable.from(
      (async function* () {
        for await (const chunk of gen) {
          if (chunk.startsWith('{"_t":"_done"')) sawDone = true;
          yield Buffer.from(chunk, "utf8");
        }
      })(),
    );

    // pipeline (unlike .pipe) propagates a mid-dump error into gz, which makes
    // the upload reject instead of hanging forever with `running` stuck true.
    const pump = pipeline(ndjsonReadable, gz);

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: tmpKey,
        Body: gz,
        ContentType: "application/gzip",
        ContentEncoding: "identity",
      },
      // 8 MB parts — minimum allowed by S3/R2 multipart.
      partSize: 8 * 1024 * 1024,
      // Keep queue shallow to avoid buffering the entire dump in memory.
      queueSize: 2,
    });

    await Promise.all([upload.done(), pump]);

    if (!sawDone) {
      throw new Error("dump ended without _done marker — refusing to promote truncated backup");
    }

    // Promote the verified dump to the final key, then drop the staging object.
    await client.send(
      new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${tmpKey}`, Key: key }),
    );
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: tmpKey }));

    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[backup-cron] uploaded ${key} in ${elapsedSec}s`);

    // --- Retention policy ---
    // List all keys matching BACKUP_KEY_RE (at most ~1000 items for 30-day window).
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX }),
    );
    const allKeys = (list.Contents ?? []).map((o) => o.Key ?? "");
    const managed = allKeys
      .filter((k) => BACKUP_KEY_RE.test(k))
      .sort(); // lexicographic = chronological for YYYY-MM-DD keys
    // Staging leftovers from crashed runs. Today's tmp was just deleted above;
    // exclude it anyway in case the listing is stale.
    const staleTmp = allKeys.filter((k) => TMP_KEY_RE.test(k) && k !== tmpKey);

    // Determine the cutoff date (30 days ago).
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);
    const cutoffStr = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(
      cutoffDate,
    );

    // Safety invariant 1: always keep at least the newest KEEP_MINIMUM backups.
    // Safety invariant 2: never delete today's backup (key === the one we just wrote).
    // Only candidates older than the cutoff date and outside the newest KEEP_MINIMUM
    // window are deleted.
    const newest = managed.slice(-KEEP_MINIMUM); // newest KEEP_MINIMUM by sort order
    const toDelete = managed.filter((k) => {
      // Extract the date portion: "backups/db-YYYY-MM-DD.ndjson.gz" → "YYYY-MM-DD"
      const dateStr = k.slice("backups/db-".length, "backups/db-".length + 10);
      const olderThanCutoff = dateStr < cutoffStr;
      const isProtected = newest.includes(k) || k === key; // guard 1 + guard 2
      return olderThanCutoff && !isProtected;
    });

    const expired = [...toDelete, ...staleTmp];
    if (expired.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: expired.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      console.log(`[backup-cron] deleted ${expired.length} old backup(s): ${expired.join(", ")}`);
    }
  } catch (err) {
    console.error("[backup-cron] backup failed:", err);
    // Unblock the pipeline if the failure came from the upload side.
    gz.destroy();
    // Best-effort: drop the staging object (no-op if it never materialized).
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: tmpKey }));
    } catch {
      /* ignore */
    }
  } finally {
    running = false;
  }
}

export async function GET(req: NextRequest) {
  assertCron(req);

  const r2 = getR2ClientAndBucket();
  if (!r2) {
    return Response.json({ ok: false, error: "r2 not configured" }, { status: 503 });
  }
  const { client, bucket } = r2;

  // Idempotency: if today's backup already exists in R2, skip.
  const today = taipeiDateString();
  const key = `${BACKUP_PREFIX}db-${today}.ndjson.gz`;

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    // HeadObject succeeded → object exists.
    return Response.json({ ok: true, skipped: true, key });
  } catch (err: unknown) {
    // R2 throws a NoSuchKey / NotFound error when the object doesn't exist.
    const code =
      err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    if (code !== "NotFound" && code !== "NoSuchKey") {
      // Unexpected error checking existence.
      console.error("[backup-cron] HeadObject error:", err);
      return Response.json({ ok: false, error: "head check failed" }, { status: 500 });
    }
    // Object not found — proceed.
  }

  // Anti-concurrency lock: if a backup is already running in this process, bail.
  if (running) {
    return Response.json({ ok: false, running: true }, { status: 409 });
  }
  running = true;

  // Detached execution: respond 202 immediately so the upstream pinger doesn't
  // time out waiting for the dump to finish (can take several minutes).
  // runBackup resets `running = false` in its finally block.
  void runBackup(key);

  return Response.json({ ok: true, started: true, key }, { status: 202 });
}
