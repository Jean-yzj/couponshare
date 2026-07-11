import { prisma } from "./db";
import { runExpireCoupons, runExpiringSoon, runPendingTimeout } from "./cron-jobs";

// In-process cron. The Zeabur container is a single long-lived Node server, so a
// timer here runs the housekeeping jobs without any external scheduler or secret.
// Each job is also idempotent (conditional status updates), and across MULTIPLE
// instances a Postgres advisory lock ensures only one runs the jobs per tick.
let started = false;
const EVERY_MS = 15 * 60 * 1000;
// Arbitrary constant lock id shared by all instances — only one can hold it.
const CRON_LOCK_KEY = 4210011001;

async function runJobs() {
  try {
    const r = await runExpireCoupons();
    if (r.expired || r.delisted_stale) console.log("[cron] expire", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] expire failed", e);
  }
  try {
    await runExpiringSoon();
  } catch (e) {
    console.error("[cron] expiring-soon failed", e);
  }
  try {
    await runPendingTimeout();
  } catch (e) {
    console.error("[cron] pending-timeout failed", e);
  }
}

async function tick() {
  try {
    // Single-flight across instances: hold a transaction-scoped advisory lock while
    // the jobs run (they use their own connections). If another instance already
    // holds it, skip this tick. The lock auto-releases when this tx ends.
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${CRON_LOCK_KEY}) AS locked
        `;
        if (!rows[0]?.locked) return;
        await runJobs();
      },
      { timeout: EVERY_MS - 30_000, maxWait: 5_000 },
    );
  } catch (e) {
    console.error("[cron] tick failed", e);
  }
}

export function startCronScheduler() {
  if (started) return;
  if (process.env.DISABLE_CRON === "1") {
    console.log("[cron] scheduler disabled via DISABLE_CRON");
    return;
  }
  started = true;
  // First pass ~30s after boot (clears any backlog once the DB pool is warm),
  // then every 15 minutes.
  setTimeout(() => void tick(), 30_000);
  const iv = setInterval(() => void tick(), EVERY_MS);
  (iv as unknown as { unref?: () => void }).unref?.();
  console.log("[cron] in-process scheduler started (every 15m)");
}
