import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { appealSchema } from "@/lib/validation";

// Suspended accounts get ONE appeal, ever. A rejected appeal is final — this closes
// the "reject → immediately re-appeal → spam the queue" loop.
export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.status !== "SUSPENDED") {
    throw new ApiError("FORBIDDEN", { message: "只有被停權的帳號可以提出申訴" });
  }
  const { message } = await readBody(req, appealSchema);

  const existing = await prisma.appeal.findFirst({
    where: { userId: user.id, status: { in: ["PENDING", "REJECTED"] } },
  });
  if (existing) {
    throw new ApiError("VALIDATION_ERROR", {
      message:
        existing.status === "REJECTED"
          ? "你的申訴已被駁回，依規定無法再次申訴。"
          : "你已有一筆審核中的申訴。",
    });
  }

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
