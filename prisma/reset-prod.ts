import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Standalone maintenance script: load .env so DATABASE_URL (external endpoint)
// is available, then optionally wipe all data. Run with --wipe to delete.
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();
const wipe = process.argv.includes("--wipe");

async function counts(label: string) {
  const [users, coupons, claims, txns, reports, ledger, notif, follows, appeals, ratings, msgs, audit] =
    await Promise.all([
      prisma.user.count(),
      prisma.coupon.count(),
      prisma.claimRequest.count(),
      prisma.transaction.count(),
      prisma.report.count(),
      prisma.scoreLedger.count(),
      prisma.notification.count(),
      prisma.brandFollow.count(),
      prisma.appeal.count(),
      prisma.rating.count(),
      prisma.transactionMessage.count(),
      prisma.auditLog.count(),
    ]);
  console.log(
    `[${label}] users=${users} coupons=${coupons} claims=${claims} txns=${txns} reports=${reports} ` +
      `ledger=${ledger} notif=${notif} follows=${follows} appeals=${appeals} ratings=${ratings} msgs=${msgs} audit=${audit}`,
  );
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log("DB:", url.replace(/\/\/[^@]*@/, "//***@"));
  await counts("before");
  if (!wipe) {
    console.log("(dry run — pass --wipe to delete everything)");
    return;
  }
  await prisma.rating.deleteMany();
  await prisma.transactionMessage.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.claimRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scoreLedger.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.brandFollow.deleteMany();
  await prisma.appeal.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.user.deleteMany();
  await counts("after");
  console.log("WIPED — database is now clean.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
