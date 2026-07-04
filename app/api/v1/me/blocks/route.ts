import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { publicUser } from "@/lib/serialize";
import { blockUserSchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    include: { blocked: true },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({
    data: blocks.map((b) => ({
      id: b.id,
      blocked_at: b.createdAt,
      user: publicUser(b.blocked),
    })),
  });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readBody(req, blockUserSchema);
  if (body.user_id === user.id) throw new ApiError("VALIDATION_ERROR", { message: "不能封鎖自己" });

  const target = await prisma.user.findUnique({ where: { id: body.user_id } });
  if (!target || target.status === "DELETED") throw new ApiError("NOT_FOUND");

  try {
    const block = await prisma.block.create({
      data: { blockerId: user.id, blockedId: target.id },
    });
    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "user.block",
      targetType: "user",
      targetId: target.id,
      ip: meta.ip,
      ua: meta.ua,
    });
    return jsonOk({ id: block.id, blocked_user_id: target.id }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonOk({ blocked_user_id: target.id });
    }
    throw err;
  }
});
