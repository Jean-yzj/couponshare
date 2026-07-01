import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";

export const POST = route(async (req) => {
  throttle(req, "login", 10, 5 * 60_000);
  const body = await readBody(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    throw new ApiError("INVALID_CREDENTIALS");
  }
  if (user.status === "DELETED") throw new ApiError("INVALID_CREDENTIALS");
  // Suspended accounts CAN log in (read-only) so they can submit an appeal.

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  return jsonOk({ id: user.id, display_name: user.displayName });
});
