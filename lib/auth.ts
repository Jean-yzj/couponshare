import type { User } from "@prisma/client";
import { prisma } from "./db";
import { getSessionUserId } from "./session";
import { ApiError } from "./errors";

export async function getCurrentUser(): Promise<User | null> {
  const uid = await getSessionUserId();
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
