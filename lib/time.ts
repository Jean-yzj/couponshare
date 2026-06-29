// Asia/Taipei (UTC+8) day/month boundaries, returned as UTC instants.
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function startOfTodayTaipei(now: Date = new Date()): Date {
  const shifted = now.getTime() + TZ_OFFSET_MS;
  const dayStart = Math.floor(shifted / 86_400_000) * 86_400_000;
  return new Date(dayStart - TZ_OFFSET_MS);
}

export function startOfMonthTaipei(now: Date = new Date()): Date {
  const t = new Date(now.getTime() + TZ_OFFSET_MS);
  const firstTaipei = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1, 0, 0, 0);
  return new Date(firstTaipei - TZ_OFFSET_MS);
}
