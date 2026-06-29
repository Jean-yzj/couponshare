import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { createSession } from "@/lib/session";
import { publicUser } from "@/lib/serialize";
import { demoLoginSchema } from "@/lib/validation";

export const DEMO_DOMAIN = "@demo.couponshare.app";

// List demo personas for the one-click login screen.
export const GET = route(async () => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    orderBy: { contributionScore: "desc" },
  });
  return jsonOk({
    data: users.map((u) => ({ ...publicUser(u), email: u.email })),
  });
});

// One-click login as a demo persona (no password — demo accounts only).
export const POST = route(async (req) => {
  const { user_id } = await readBody(req, demoLoginSchema);
  const user = await prisma.user.findUnique({ where: { id: user_id } });
  if (!user || !user.email?.endsWith(DEMO_DOMAIN)) throw new ApiError("FORBIDDEN");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  return jsonOk({ id: user.id, display_name: user.displayName });
});
