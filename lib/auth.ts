import type { User } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "./db";
import { getSessionUserId, verifySessionToken } from "./session";
import { ApiError } from "./errors";
import { touchActivity } from "./activity";

export async function getBearerSession(): Promise<{ present: boolean; uid: string | null }> {
  const auth = (await headers()).get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return { present: false, uid: null };
  return { present: true, uid: verifySessionToken(m[1]) };
}

export async function getCurrentUser(): Promise<User | null> {
  let uid = await getSessionUserId();
  if (!uid) {
    uid = (await getBearerSession()).uid;
  }
  if (!uid) return null;
  // findUnique with no select returns all columns, so lastSeenAt is included
  // once the column exists (post-migration). Until then the field is undefined
  // and touchActivity's null-check handles it gracefully.
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user || user.status === "DELETED") return null;
  // Fire-and-forget activity ping (3-min throttle, never blocks the request).
  touchActivity(user);
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("UNAUTHORIZED");
  return user;
}

export async function requireActiveUser(): Promise<User> {
  const user = await requireUser();
  if (user.status === "SUSPENDED") throw new ApiError("USER_SUSPENDED");
  return user;
}
