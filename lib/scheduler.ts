import {
  runAutoCompleteGifts,
  runCloseAbandonedListings,
  runDedupeBarcodes,
  runPruneBackups,
  runPurgeExpiredBarcodes,
  runExpireCoupons,
  runExpiringSoon,
  runPendingTimeout,
  runPurgeDeletedUsers,
} from "./cron-jobs";

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
  try {
    // GIFT transactions nobody disputed for a week. The confirm button exists for
    // the platform's records, not for the two people involved, so 59% of all
    // transactions sat in CREATED forever and the completion metric measured
    // button-pressing instead of giving.
    const r = await runAutoCompleteGifts();
    if (r.completed) console.log("[cron] auto-complete-gifts", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] auto-complete-gifts failed", e);
  }
  try {
    // The sibling of the zero-application delist above: listings whose owner
    // never answered anyone. Those are worse than unwanted — they draw people in
    // and leave them waiting (2,102 applications on 76 coupons before this ran).
    const r = await runCloseAbandonedListings();
    if (r.delisted || r.stranded_requests_closed) console.log("[cron] close-abandoned", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] close-abandoned failed", e);
  }
  try {
    // Retention limit from the privacy policy. Runs on the same 15-minute tick as
    // everything else; it is a no-op on most passes because it only matches
    // accounts deleted over six months ago that it has not already scrubbed.
    const r = await runPurgeDeletedUsers();
    if (r.purged || r.held_open_matter) console.log("[cron] purge-deleted", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] purge-deleted failed", e);
  }
  try {
    // Keeps barcode storage de-duplicated. A one-off cleanup does not hold: the
    // upload path writes both copies by design, so duplicates return within days.
    const r = await runDedupeBarcodes();
    if (r.cleared || r.skipped) console.log("[cron] dedupe-barcodes", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] dedupe-barcodes failed", e);
  }
  try {
    // Expired and cancelled coupons cannot be redeemed, so their barcodes are
    // dead weight — and they are the most sensitive field we hold.
    const r = await runPurgeExpiredBarcodes();
    if (r.cleared || r.held_evidence) console.log("[cron] purge-expired-barcodes", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] purge-expired-barcodes failed", e);
  }
  try {
    // Backups had no retention at all and had grown to 30GB, each copy holding
    // every user's email and password hash.
    const r = await runPruneBackups();
    if (r.deleted) console.log("[cron] prune-backups", JSON.stringify(r));
  } catch (e) {
    console.error("[cron] prune-backups failed", e);
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
