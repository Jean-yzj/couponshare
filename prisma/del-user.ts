import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Delete ONE user (by email) and their records — for cleaning up throwaway test
// accounts without wiping the whole DB. Usage: npx tsx prisma/del-user.ts <email>
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const p = new PrismaClient();
const email = process.argv[2];

async function main() {
  if (!email) {
    console.log("usage: tsx prisma/del-user.ts <email>");
    return;
  }
  const u = await p.user.findUnique({ where: { email } });
  if (!u) {
    console.log("no user:", email);
    return;
  }
  const id = u.id;
  await p.transactionMessage.deleteMany({ where: { senderId: id } });
  await p.rating.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } });
  await p.transaction.deleteMany({ where: { OR: [{ ownerId: id }, { claimantId: id }] } });
  await p.claimRequest.deleteMany({ where: { requesterId: id } });
  await p.report.deleteMany({ where: { OR: [{ reporterId: id }, { reportedUserId: id }] } });
  await p.scoreLedger.deleteMany({ where: { userId: id } });
  await p.notification.deleteMany({ where: { userId: id } });
  await p.brandFollow.deleteMany({ where: { userId: id } });
  await p.appeal.deleteMany({ where: { userId: id } });
  await p.coupon.deleteMany({ where: { ownerId: id } });
  await p.user.delete({ where: { id } });
  console.log("deleted user + data:", email);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
