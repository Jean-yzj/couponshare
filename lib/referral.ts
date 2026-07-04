import { prisma } from "./db";

// Number of extra applications the inviter gets, for each friend who signs up
// through their invite link, on the day that friend registers.
export const REFERRAL_BONUS = 2;

// Cookie that carries an invite ref through the Google OAuth round-trip (the ref
// can't ride in the query the way it can for email register).
export const REF_COOKIE = "cs_ref";

// Validates an invite ref (an inviter's user id) and returns it only if it points
// to a real, active account that isn't the new user themselves. Returns null on
// anything invalid so callers can simply ignore bad/forged refs.
export async function resolveReferrer(
  ref: string | null | undefined,
  selfId?: string,
): Promise<string | null> {
  const id = ref?.trim();
  if (!id || id === selfId) return null;
  const inviter = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!inviter || inviter.status !== "ACTIVE") return null;
  return inviter.id;
}
