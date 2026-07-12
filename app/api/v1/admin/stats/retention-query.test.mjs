import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("./route.ts", import.meta.url), "utf8");
const retentionQuery = routeSource.slice(
  routeSource.indexOf("// ── retention: 8 cohort weeks"),
  routeSource.indexOf("WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '48 hours'"),
);

test("retention query aggregates activity with one join instead of per-user correlated scans", () => {
  assert.match(retentionQuery, /LEFT JOIN activity a/);
  assert.match(retentionQuery, /BOOL_OR\(/);
  assert.doesNotMatch(retentionQuery, /EXISTS\s*\(/);
});
