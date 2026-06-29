import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError, errorResponse } from "./errors";

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
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : req.headers.get("x-real-ip");
  return { ip: ip ?? null, ua: req.headers.get("user-agent") };
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
