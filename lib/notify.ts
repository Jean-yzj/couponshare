import type { Prisma, PrismaClient, NotificationType } from "@prisma/client";
import { prisma } from "./db";

type Db = PrismaClient | Prisma.TransactionClient;
type PushRecord = { token: string };
type NotifyArgs = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function withDeadline(ms: number): AbortSignal {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  (t as unknown as { unref?: () => void }).unref?.();
  return ctl.signal;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function sendExpoPush(tokens: PushRecord[], args: NotifyArgs): Promise<void> {
  for (const batch of chunks(tokens, 100)) {
    const messages = batch.map((t) => ({
      to: t.token,
      title: args.title,
      body: args.body,
      sound: "default",
      data: {
        type: args.type,
        reference_type: args.referenceType ?? null,
        reference_id: args.referenceId ?? null,
      },
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: withDeadline(10_000),
      body: JSON.stringify(messages),
    });
    if (!res.ok) continue;

    const payload = (await res.json()) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    const invalid = batch
      .filter((_, idx) => payload.data?.[idx]?.details?.error === "DeviceNotRegistered")
      .map((t) => t.token);
    if (invalid.length) await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
  }
}

export async function notify(
  db: Db,
  args: NotifyArgs,
): Promise<void> {
  await db.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
    },
  });

  try {
    const tokens = await db.pushToken.findMany({
      where: { userId: args.userId, platform: "ios" },
      select: { token: true },
    });
    if (tokens.length) await sendExpoPush(tokens, args);
  } catch (err) {
    console.warn("[push] expo send failed", err);
  }
}
