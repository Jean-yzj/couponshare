import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { pushTokenSchema, deletePushTokenSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readBody(req, pushTokenSchema);

  try {
    await prisma.pushToken.create({
      data: { userId: user.id, token: body.token, platform: body.platform },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await prisma.pushToken.update({
        where: { token: body.token },
        data: { userId: user.id, platform: body.platform },
      });
    } else {
      throw err;
    }
  }

  return jsonOk({ ok: true }, 201);
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const body = await readBody(req, deletePushTokenSchema);

  await prisma.pushToken.deleteMany({
    where: body.token ? { userId: user.id, token: body.token } : { userId: user.id },
  });

  return jsonOk({ ok: true });
});
