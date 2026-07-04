// Next.js startup hook — runs once when the server process boots. We use it to
// start the in-process cron scheduler (coupon expiry / stale-delist / reminders)
// so no external scheduler is needed. Only on the Node.js runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startCronScheduler } = await import("./lib/scheduler");
  startCronScheduler();
}
