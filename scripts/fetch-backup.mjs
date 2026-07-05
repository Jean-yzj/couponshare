#!/usr/bin/env node
// Resumable full-DB backup fetcher. The backup endpoint can't move the whole
// ~486MB DB before Zeabur's ~10-min gateway timeout, so it hands back a resume
// cursor after each ~40MB slice; this loops until it sees the _done marker.
//
// Each response is one gzip member; concatenating them yields one valid .gz that
// the importer reads (it skips the _meta/_next/_done markers). A slice is only
// appended once it decompresses AND ends with a marker, so a gateway-truncated
// response is retried (idempotent — same cursor = same data), never half-written.
//
// Usage: BACKUP_URL=https://... BACKUP_SECRET=xxx OUT=backup.ndjson.gz node scripts/fetch-backup.mjs
import { writeFileSync, appendFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const BASE = (process.env.BACKUP_URL || process.argv[2] || "").replace(/\/+$/, "");
const SECRET = process.env.BACKUP_SECRET || process.argv[3];
const OUT = process.env.OUT || process.argv[4] || "backup.ndjson.gz";
const MAX_ATTEMPTS = 4;

if (!BASE || !SECRET) {
  console.error("need BACKUP_URL and BACKUP_SECRET (env or argv[2],[3])");
  process.exit(1);
}

writeFileSync(OUT, Buffer.alloc(0)); // truncate / create

let token = "";
let req = 0;
let totalBytes = 0;
const started = Date.now();

for (;;) {
  const url = `${BASE}/api/v1/admin/backup${token ? `?after=${encodeURIComponent(token)}` : ""}`;
  let good = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !good; attempt++) {
    try {
      const res = await fetch(url, { headers: { "x-backup-secret": SECRET } });
      if (!res.ok) {
        console.error(`  req ${req + 1} attempt ${attempt}: HTTP ${res.status}`);
        continue;
      }
      const gz = Buffer.from(await res.arrayBuffer());
      const text = gunzipSync(gz).toString("utf8"); // throws if truncated
      const lines = text.replace(/\n+$/, "").split("\n");
      const marker = JSON.parse(lines[lines.length - 1]);
      if (marker._t === "_next" || marker._t === "_done") {
        good = { gz, marker };
      } else {
        console.error(`  req ${req + 1} attempt ${attempt}: response had no _next/_done marker`);
      }
    } catch (e) {
      console.error(`  req ${req + 1} attempt ${attempt}: ${e.message?.slice(0, 80)}`);
    }
  }
  if (!good) {
    console.error(`FAILED: gave up after ${MAX_ATTEMPTS} attempts at cursor "${token}"`);
    process.exit(1);
  }
  appendFileSync(OUT, good.gz);
  req++;
  totalBytes += good.gz.length;
  console.error(
    `  req ${req}: +${(good.gz.length / 1048576).toFixed(1)}MB (total ${(totalBytes / 1048576).toFixed(1)}MB) marker=${good.marker._t}`,
  );
  if (good.marker._t === "_done") break;
  token = good.marker.after;
}

const secs = ((Date.now() - started) / 1000).toFixed(0);
console.error(`DONE: ${req} requests, ${(totalBytes / 1048576).toFixed(1)}MB in ${secs}s → ${OUT}`);
