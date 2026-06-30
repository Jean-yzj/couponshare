import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { appealSchema } from "@/lib/validation";

// Suspended accounts can appeal once (pending) for manual review.
export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.status !== "SUSPENDED") {
    throw new ApiError("FORBIDDEN", { message: "只有被停權的帳號可以提出申訴" });
  }
  const { message } = await readBody(req, appealSchema);

  const pending = await prisma.appeal.findFirst({
    where: { userId: user.id, status: "PENDING" },
  });
  if (pending) throw new ApiError("VALIDATION_ERROR", { message: "你已有一筆審核中的申訴" });

  const appeal = await prisma.appeal.create({ data: { userId: user.id, message } });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "appeal.create",
    targetType: "appeal",
    targetId: appeal.id,
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id: appeal.id, status: appeal.status }, 201);
});
