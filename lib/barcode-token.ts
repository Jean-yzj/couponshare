import { sign, safeEqual } from "./crypto";

const TTL_S = 300; // 5-minute signed access — PRD §8.1

function secret(): string {
  return process.env.SESSION_SECRET ?? "insecure-dev-secret";
}

export function issueBarcodeToken(
  couponId: string,
  userId: string,
): { token: string; expiresIn: number } {
  const exp = Date.now() + TTL_S * 1000;
  const body = Buffer.from(JSON.stringify({ cid: couponId, uid: userId, exp })).toString(
    "base64url",
  );
  return { token: `${body}.${sign(body, secret())}`, expiresIn: TTL_S };
}

export function verifyBarcodeToken(token: string): { cid: string; uid: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sign(body, secret()), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      cid?: string;
      uid?: string;
      exp?: number;
    };
    if (!p.cid || !p.uid || !p.exp || p.exp < Date.now()) return null;
    return { cid: p.cid, uid: p.uid };
  } catch {
    return null;
  }
}
