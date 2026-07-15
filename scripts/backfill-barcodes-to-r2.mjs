import { createHash } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_BATCH = 100;
const DEFAULT_BATCH = 25;
const CONCURRENCY = 3;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function batchLimit() {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  const parsed = Number(argument?.split("=")[1] ?? DEFAULT_BATCH);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_BATCH}`);
  }
  return parsed;
}

const bucket = requiredEnv("R2_BUCKET");
const client = new S3Client({
  region: "auto",
  endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
});

async function migrate(coupon) {
  const body = Buffer.from(coupon.barcodeEncryptedData, "base64");
  if (body.length === 0 || body.length > 8 * 1024 * 1024) {
    throw new Error(`invalid encrypted size for coupon ${coupon.id}: ${body.length}`);
  }

  const sha256 = createHash("sha256").update(body).digest("hex");
  const key = `barcodes/coupons/${coupon.id}/${sha256}.enc`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
      Metadata: { sha256 },
    }),
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentLength !== body.length || head.Metadata?.sha256 !== sha256) {
    throw new Error(`R2 verification failed for coupon ${coupon.id}`);
  }

  const updated = await prisma.coupon.updateMany({
    where: {
      id: coupon.id,
      updatedAt: coupon.updatedAt,
      barcodeStorageKey: null,
    },
    data: { barcodeStorageKey: key },
  });
  return updated.count === 1 ? "migrated" : "changed-during-copy";
}

async function main() {
  const coupons = await prisma.coupon.findMany({
    where: { barcodeStorageKey: null, barcodeEncryptedData: { not: null } },
    orderBy: { id: "asc" },
    take: batchLimit(),
    select: { id: true, barcodeEncryptedData: true, updatedAt: true },
  });

  let index = 0;
  const results = { selected: coupons.length, migrated: 0, changedDuringCopy: 0, failed: 0 };
  const failures = [];

  async function worker() {
    while (index < coupons.length) {
      const coupon = coupons[index++];
      try {
        const status = await migrate(coupon);
        if (status === "migrated") results.migrated += 1;
        else results.changedDuringCopy += 1;
      } catch (error) {
        results.failed += 1;
        failures.push({
          couponId: coupon.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, coupons.length) }, () => worker()));
  const remaining = await prisma.coupon.count({
    where: { barcodeStorageKey: null, barcodeEncryptedData: { not: null } },
  });

  console.log(JSON.stringify({ ...results, remaining, failures }, null, 2));
  if (results.failed > 0) process.exitCode = 1;
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
