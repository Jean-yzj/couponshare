import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { throttle } from "@/lib/throttle";
import { updateProfileSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  throttle(req, "profile", 20, 10 * 60_000);
  const user = await requireUser();
  const body = await readBody(req, updateProfileSchema);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { displayName: body.display_name },
    select: { displayName: true },
  });

  return jsonOk({ display_name: updated.displayName });
});
