import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_ENCRYPTED_BARCODE_BYTES = 8 * 1024 * 1024;

type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null | undefined;

function r2Config(): R2Config | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const values = {
    accountId: process.env.R2_ACCOUNT_ID,
    bucket: process.env.R2_BUCKET,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  };
  const configured = Object.values(values).filter(Boolean).length;
  if (configured === 0) {
    cachedConfig = null;
    return null;
  }
  if (configured !== Object.keys(values).length) {
    throw new Error("R2 barcode storage is partially configured");
  }

  cachedConfig = values as R2Config;
  return cachedConfig;
}

function r2Client(config: R2Config): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

function encryptedBytes(encrypted: string): Buffer {
  const bytes = Buffer.from(encrypted, "base64");
  if (bytes.length === 0 || bytes.length > MAX_ENCRYPTED_BARCODE_BYTES) {
    throw new Error(`Invalid encrypted barcode size: ${bytes.length}`);
  }
  return bytes;
}

export function barcodeObjectKey(couponId: string, encrypted: string): string {
  const digest = createHash("sha256").update(encryptedBytes(encrypted)).digest("hex");
  return `barcodes/coupons/${couponId}/${digest}.enc`;
}

export function isBarcodeStorageConfigured(): boolean {
  return r2Config() !== null;
}

// Store the already AES-256-GCM-encrypted payload. R2 never receives plaintext.
// The content-addressed key is immutable, so retries are idempotent and a user
// replacing a barcode while backfill runs cannot overwrite the newer object.
export async function putEncryptedBarcode(couponId: string, encrypted: string): Promise<string> {
  const config = r2Config();
  if (!config) throw new Error("R2 barcode storage is not configured");

  const body = encryptedBytes(encrypted);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const key = `barcodes/coupons/${couponId}/${sha256}.enc`;
  const client = r2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
      Metadata: { sha256 },
    }),
  );

  const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  if (head.ContentLength !== body.length || head.Metadata?.sha256 !== sha256) {
    throw new Error(`R2 verification failed for ${key}`);
  }
  return key;
}

export async function getEncryptedBarcode(key: string): Promise<string> {
  const config = r2Config();
  if (!config) throw new Error("R2 barcode storage is not configured");
  if (!key.startsWith("barcodes/coupons/") || key.includes("..")) {
    throw new Error("Invalid barcode storage key");
  }

  const result = await r2Client(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  if (!result.Body) throw new Error(`R2 object body missing for ${key}`);
  const bytes = Buffer.from(await result.Body.transformToByteArray());
  if (bytes.length === 0 || bytes.length > MAX_ENCRYPTED_BARCODE_BYTES) {
    throw new Error(`Invalid R2 barcode size: ${bytes.length}`);
  }

  const expected = result.Metadata?.sha256;
  if (!expected) throw new Error(`R2 checksum metadata missing for ${key}`);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`R2 checksum mismatch for ${key}`);
  return bytes.toString("base64");
}
