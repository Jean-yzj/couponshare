import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { getFlags, setFlag, FLAG_CLAIMS_PAUSED, FLAG_REGISTER_PAUSED } from "@/lib/settings";

const KEYS = [FLAG_CLAIMS_PAUSED, FLAG_REGISTER_PAUSED];

// Emergency kill-switches. GET reports current state; POST flips one flag. Used to
// stop the bleeding fast during an abuse incident without a redeploy.
export const GET = route(async () => {
  await requireAdmin();
  return jsonOk({ flags: await getFlags(KEYS) });
});

const schema = z.object({
  key: z.enum([FLAG_CLAIMS_PAUSED, FLAG_REGISTER_PAUSED]),
  value: z.boolean(),
});

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { key, value } = await readBody(req, schema);
  const meta = clientMeta(req);

  await setFlag(key, value);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: value ? "admin.flag.on" : "admin.flag.off",
    targetType: "app_setting",
    targetId: key,
    after: { value },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ flags: await getFlags(KEYS) });
});
