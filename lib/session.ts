import { cookies } from "next/headers";
import { sign, safeEqual } from "./crypto";

const COOKIE = "cs_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
const TOKEN_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 days for native apps

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // Fail closed in production: a missing secret must never silently fall back to a
  // known value — that would let anyone forge a session cookie for any account.
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "insecure-dev-secret";
}

function createSignedSessionToken(userId: string, maxAgeS: number): string {
  const payload = { uid: userId, exp: Date.now() + maxAgeS * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret())}`;
}

export function createBearerToken(userId: string): string {
  return createSignedSessionToken(userId, TOKEN_MAX_AGE_S);
}

export async function createSession(userId: string): Promise<void> {
  const token = createSignedSessionToken(userId, MAX_AGE_S);
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

export function verifySessionToken(token: string | null | undefined): string | null {
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

export async function getSessionUserId(): Promise<string | null> {
  return verifySessionToken((await cookies()).get(COOKIE)?.value);
}
