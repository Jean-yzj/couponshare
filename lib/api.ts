import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError, errorResponse } from "./errors";
import { clientIp } from "./ip";

// Wraps a route handler with unified error handling. Generic over the dynamic
// segment params so both static and dynamic routes type-check against Next's
// generated route types.
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: { params: Promise<P> }) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return parsed.data;
}

export function clientMeta(req: NextRequest): { ip: string | null; ua: string | null } {
  return { ip: clientIp(req), ua: req.headers.get("user-agent") };
}

// Behind Zeabur's reverse proxy, `new URL(req.url).origin` is the internal
// container address (e.g. https://localhost:8080). Use the proxy's forwarded
// headers so OAuth redirect URIs match the public domain the user is on.
// Only trust these hosts from the proxy-set x-forwarded-host header when building
// absolute URLs / OAuth redirect URIs, so a forged Host can't point auth flows at
// an attacker domain. Anything else falls back to APP_ORIGIN.
function isTrustedHost(host: string): boolean {
  const h = host.split(":")[0];
  return (
    h === "localhost" ||
    h === "couponshare.lazybearlife.com" ||
    h.endsWith(".zeabur.app") ||
    h.endsWith(".lazybearlife.com")
  );
}

export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host && isTrustedHost(host)) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
