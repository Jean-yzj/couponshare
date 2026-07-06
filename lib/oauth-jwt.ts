import { createPublicKey, verify as verifySignature } from "crypto";

type Jwk = JsonWebKey & { kid?: string; alg?: string };
type JwtHeader = { alg?: string; kid?: string };
type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  exp?: number;
};

type JwksCache = { expiresAt: number; keys: Jwk[] };

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const caches = new Map<string, JwksCache>();

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function parseJsonPart<T>(value: string): T {
  return JSON.parse(decodeBase64Url(value).toString("utf8")) as T;
}

function audienceMatches(aud: string | string[] | undefined, expected: string): boolean {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

function withDeadline(ms: number): AbortSignal {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  (t as unknown as { unref?: () => void }).unref?.();
  return ctl.signal;
}

async function fetchJwks(url: string): Promise<Jwk[]> {
  const cached = caches.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const res = await fetch(url, { signal: withDeadline(10_000) });
  if (!res.ok) throw new Error("jwks fetch failed");
  const data = (await res.json()) as { keys?: Jwk[] };
  const keys = data.keys ?? [];
  const maxAge = /max-age=(\d+)/i.exec(res.headers.get("cache-control") || "")?.[1];
  caches.set(url, {
    keys,
    expiresAt: Date.now() + Math.max(300, Number(maxAge) || 3600) * 1000,
  });
  return keys;
}

async function verifyJwtWithJwks(token: string, jwksUrl: string, issuer: string, audience: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid jwt");
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = parseJsonPart<JwtHeader>(encodedHeader);
  const payload = parseJsonPart<JwtPayload>(encodedPayload);

  if (!header.kid || !header.alg) throw new Error("jwt header missing kid/alg");
  if (payload.iss !== issuer) throw new Error("jwt issuer mismatch");
  if (!audienceMatches(payload.aud, audience)) throw new Error("jwt audience mismatch");
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error("jwt expired");

  const keys = await fetchJwks(jwksUrl);
  const jwk = keys.find((k) => k.kid === header.kid && (!k.alg || k.alg === header.alg));
  if (!jwk) throw new Error("jwt key not found");

  if (header.alg !== "RS256") throw new Error("jwt alg unsupported");

  const publicKeyInput = { key: jwk, format: "jwk" } as Parameters<typeof createPublicKey>[0];
  const ok = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey(publicKeyInput),
    decodeBase64Url(encodedSignature),
  );
  if (!ok) throw new Error("jwt signature invalid");
  return payload;
}

export async function verifyGoogleIdToken(idToken: string) {
  const audience = process.env.GOOGLE_IOS_CLIENT_ID;
  if (!audience) throw new Error("GOOGLE_IOS_CLIENT_ID is not set");
  const payload = await verifyJwtWithJwks(idToken, GOOGLE_JWKS_URL, "https://accounts.google.com", audience);
  if (!payload.sub || !payload.email) throw new Error("google token missing identity");
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    // Whether Google has verified ownership of this email. Callers MUST check this
    // before linking to an existing account by email, or an unverified token could
    // attach to (and take over) someone else's account.
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: payload.name || payload.email,
    picture: payload.picture ?? null,
  };
}

export async function verifyAppleIdentityToken(identityToken: string) {
  const audience = process.env.APPLE_BUNDLE_ID;
  if (!audience) throw new Error("APPLE_BUNDLE_ID is not set");
  const payload = await verifyJwtWithJwks(identityToken, APPLE_JWKS_URL, "https://appleid.apple.com", audience);
  if (!payload.sub) throw new Error("apple token missing subject");
  const email = payload.email ? payload.email.trim().toLowerCase() : null;
  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}
