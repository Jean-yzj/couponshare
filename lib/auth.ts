import type { User } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "./db";
import { getSessionUserId, verifySessionToken } from "./session";
import { ApiError } from "./errors";

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
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user || user.status === "DELETED") return null;
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
