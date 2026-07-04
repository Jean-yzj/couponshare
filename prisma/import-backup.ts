import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

// Restore a backup produced by GET /api/v1/admin/backup (gzipped NDJSON, one
// {"_t":<model>,"r":<row>} per line) into a database. The file is ordered
// parents-first (user → coupon → claimRequest → transaction → …) so inserting in
// file order satisfies foreign keys. DateTime fields are ISO strings, which
// Prisma accepts on create. Rows are plain scalars (no nested relations).
//
// Usage (point DATABASE_URL at the TARGET/recovery DB — NOT prod):
//   DATABASE_URL=postgresql://… npx tsx prisma/import-backup.ts <backup.ndjson.gz>
//   npx tsx prisma/import-backup.ts --dry-run <backup.ndjson.gz>   # parse only
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));
const p = new PrismaClient();

// Flush when a batch reaches this many rows OR this many bytes — the byte cap
// keeps coupon inserts (up to ~6.7MB barcodes each) from blowing up memory.
const MAX_ROWS = 500;
const MAX_BYTES = 16_000_000;

async function main() {
  if (!file) {
    console.log("usage: tsx prisma/import-backup.ts [--dry-run] <backup.ndjson.gz>");
    return;
  }
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });

  let curModel = "";
  let buf: unknown[] = [];
  let bytes = 0;
  const counts: Record<string, number> = {};

  const flush = async () => {
    if (curModel && buf.length) {
      if (!dryRun) {
        const r = await (
          p as unknown as Record<string, { createMany: (a: unknown) => Promise<{ count: number }> }>
        )[curModel].createMany({ data: buf, skipDuplicates: true });
        counts[curModel] = (counts[curModel] ?? 0) + r.count;
      } else {
        counts[curModel] = (counts[curModel] ?? 0) + buf.length;
      }
    }
    buf = [];
    bytes = 0;
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const o = JSON.parse(line) as { _t: string; r?: unknown; exportedAt?: string };
    if (o._t === "_meta") {
      console.log(`${dryRun ? "[dry-run] " : ""}restoring backup exported at ${o.exportedAt}`);
      continue;
    }
    if (o._t !== curModel) {
      await flush();
      curModel = o._t;
    }
    buf.push(o.r);
    bytes += line.length;
    if (buf.length >= MAX_ROWS || bytes >= MAX_BYTES) await flush();
  }
  await flush();

  console.log(`${dryRun ? "[dry-run] parsed" : "restored"}:`, JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
