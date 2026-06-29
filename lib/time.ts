// Start of "today" in Asia/Taipei (UTC+8), as a UTC instant. PRD uses +08:00.
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function startOfTodayTaipei(now: Date = new Date()): Date {
  const shifted = now.getTime() + TZ_OFFSET_MS;
  const dayStart = Math.floor(shifted / 86_400_000) * 86_400_000;
  return new Date(dayStart - TZ_OFFSET_MS);
}
