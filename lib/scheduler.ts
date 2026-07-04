import { runExpireCoupons, runExpiringSoon, runPendingTimeout } from "./cron-jobs";

// In-process cron. The Zeabur container is a single long-lived Node server, so a
// timer here runs the housekeeping jobs without any external scheduler or secret.
// Safe against duplicate runs (each job filters on current status, so an already-
// processed coupon is never matched twice) and against redeploys (restarts clean).
let started = false;
const EVERY_MS = 15 * 60 * 1000;

async function tick() {
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
