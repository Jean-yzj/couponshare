import type { User } from "@prisma/client";
import { ApiError } from "./errors";
import { requireUser } from "./auth";

// Admins are designated by the ADMIN_EMAILS env var (comma-separated).
export function isAdmin(user: { email: string | null }): boolean {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!user.email && list.includes(user.email.toLowerCase());
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new ApiError("FORBIDDEN");
  return user;
}
