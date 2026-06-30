import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const user = await requireUser();
  const appeal = await prisma.appeal.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({
    suspended: user.status === "SUSPENDED",
    appeal: appeal
      ? {
          id: appeal.id,
          status: appeal.status,
          message: appeal.message,
          admin_note: appeal.adminNote,
          created_at: appeal.createdAt,
          resolved_at: appeal.resolvedAt,
        }
      : null,
  });
});
