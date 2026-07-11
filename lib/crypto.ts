import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// ─────────────── Passwords (scrypt, no native deps) ───────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ─────────────── HMAC signing (sessions, signed URLs) ───────────────

export function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ─────────────── Opaque one-time tokens (password reset) ───────────────
// The raw token travels in the reset link; only its SHA-256 hash is stored, so a
// database leak can't be turned into a usable reset link.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─────────────── Barcode encryption (AES-256-GCM) — PRD §16.1 ───────────────

function barcodeKey(): Buffer {
  const secret = process.env.BARCODE_KEY;
  if (!secret) throw new Error("BARCODE_KEY is not set");
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

// Packed layout: iv(12) | authTag(16) | ciphertext, base64.
export function encryptBarcode(plain: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", barcodeKey(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptBarcode(packed: string): Buffer {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", barcodeKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
