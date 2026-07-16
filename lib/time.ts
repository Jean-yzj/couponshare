// Asia/Taipei (UTC+8) day/month boundaries, returned as UTC instants.
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function startOfTodayTaipei(now: Date = new Date()): Date {
  const shifted = now.getTime() + TZ_OFFSET_MS;
  const dayStart = Math.floor(shifted / 86_400_000) * 86_400_000;
  return new Date(dayStart - TZ_OFFSET_MS);
}

// Exclusive upper bound of "today" in Taipei: the next Taipei midnight as a UTC
// instant. Compare with `<` to mean "within today (Taipei time)".
export function endOfTodayTaipei(now: Date = new Date()): Date {
  const shifted = now.getTime() + TZ_OFFSET_MS;
  const nextDayStart = (Math.floor(shifted / 86_400_000) + 1) * 86_400_000;
  return new Date(nextDayStart - TZ_OFFSET_MS);
}

export function startOfMonthTaipei(now: Date = new Date()): Date {
  const t = new Date(now.getTime() + TZ_OFFSET_MS);
  const firstTaipei = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1, 0, 0, 0);
  return new Date(firstTaipei - TZ_OFFSET_MS);
}

// Calendar-month key in Taipei time, e.g. "2026-07". Used to scope the monthly
// bonus-claim pool: a balance stamped with a past month reads as expired.
export function monthKeyTaipei(now: Date = new Date()): string {
  const t = new Date(now.getTime() + TZ_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}
