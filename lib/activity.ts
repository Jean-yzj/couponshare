import { prisma } from "./db";

// Returns "YYYY-MM-DD" in Taipei time (UTC+8) for the given epoch ms.
function taipeiDay(epochMs: number): string {
  return new Date(epochMs + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// Minimal shape we need from the User record. Using an inline interface (not
// Pick<User, ...>) so the type stays valid before and after prisma generate.
interface ActivityUser {
  id: string;
  lastSeenAt: Date | null;
}

// Fire-and-forget activity ping. Called from getCurrentUser() on every
// authenticated request. Throttled to at most once per 3 minutes per user,
// with an additional upsert into daily_actives on cross-day transitions.
//
// Failures are silently swallowed — a broken ping must never break a real request.
export function touchActivity(user: ActivityUser): void {
  const now = Date.now();
  const THREE_MINUTES_MS = 3 * 60 * 1000;

  // Throttle: skip if lastSeenAt is recent enough.
  if (user.lastSeenAt && now - user.lastSeenAt.getTime() < THREE_MINUTES_MS) {
    return;
  }

  const todayTaipei = taipeiDay(now);
  const prevTaipei = user.lastSeenAt ? taipeiDay(user.lastSeenAt.getTime()) : null;
  const crossedDay = prevTaipei !== todayTaipei; // null !== string → true (new user counts as crossed)

  // Fire-and-forget: do not await, do not propagate errors.
  (async () => {
    // 1. Bump lastSeenAt.
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(now) },
    });

    // 2. If Taipei calendar day changed (or this is the first ping), record DailyActive.
    // createMany + skipDuplicates compiles to INSERT ... ON CONFLICT DO NOTHING —
    // atomic under concurrent requests, unlike upsert which can race to P2002 here.
    if (crossedDay) {
      await prisma.dailyActive.createMany({
        data: [{ day: new Date(todayTaipei), userId: user.id }],
        skipDuplicates: true,
      });
    }
  })().catch(() => {
    // Intentionally swallow — activity tracking must never break real requests.
  });
}
