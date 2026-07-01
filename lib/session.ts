import { cookies } from "next/headers";
import { sign, safeEqual } from "./crypto";

const COOKIE = "cs_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // Fail closed in production: a missing secret must never silently fall back to a
  // known value — that would let anyone forge a session cookie for any account.
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "insecure-dev-secret";
}

export async function createSession(userId: string): Promise<void> {
  const payload = { uid: userId, exp: Date.now() + MAX_AGE_S * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${body}.${sign(body, secret())}`;
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sign(body, secret()), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      uid?: string;
      exp?: number;
    };
    if (typeof payload.uid !== "string" || !payload.exp || payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
