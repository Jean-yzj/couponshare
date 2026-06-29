import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const body = await readBody(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    throw new ApiError("INVALID_CREDENTIALS");
  }
  if (user.status === "SUSPENDED") throw new ApiError("USER_SUSPENDED");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  return jsonOk({ id: user.id, display_name: user.displayName });
});
