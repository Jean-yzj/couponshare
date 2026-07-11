// Next.js startup hook — runs once when the server process boots. We use it to
// start the in-process cron scheduler (coupon expiry / stale-delist / reminders)
// so no external scheduler is needed. Only on the Node.js runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Fail fast on a misconfigured production deploy. These secrets are otherwise
  // validated lazily (on the first session / barcode op), so a deploy missing one
  // would start up "green" and only error when a real user hits that path. Better
  // to refuse to boot.
  if (process.env.NODE_ENV === "production") {
    const required = ["DATABASE_URL", "SESSION_SECRET", "BARCODE_KEY"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
  }

  const { startCronScheduler } = await import("./lib/scheduler");
  startCronScheduler();
}
