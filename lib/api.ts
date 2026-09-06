import { NextRequest, NextResponse } from "next/server";
import type { $ZodIssue } from "zod/v4/core";
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

// zod speaks English ("Too big: expected string to have <=500 characters") and
// that string never reached anyone anyway — the client only ever showed the
// registry's 「輸入資料有誤」. These two helpers turn an issue into a sentence a
// person can act on, which is the whole point of rejecting their input.
const FIELD_LABELS: Record<string, string> = {
  message: "訊息",
  comment: "評價留言",
  description: "說明",
  title: "標題",
  brand: "品牌",
  category: "分類",
  display_name: "暱稱",
  name: "名稱",
  email: "Email",
  password: "密碼",
  redeem_code: "兌換碼",
  redeem_info: "兌換方式",
  exchange_offer_text: "想交換的內容",
  exchange_target: "想換的東西",
  topic: "主題",
  image: "圖片",
  evidence_image: "審核截圖",
  reason: "原因",
  post_url: "發文連結",
  website_url: "官網網址",
  task_url: "任務連結",
  task_instruction: "任務說明",
  cta_url: "按鈕連結",
  cta_text: "按鈕文字",
  rating_score: "評分",
  expiry_date: "到期日",
};

function describeIssue(issue: $ZodIssue, raw: unknown): string | null {
  const key = issue.path.filter((p) => typeof p === "string").pop() as string | undefined;
  const label = (key && FIELD_LABELS[key]) || "";
  // A schema that already carries its own zh-Hant message (e.g. .url("網址格式不正確")
  // or a .refine) has said it better than anything generic here could.
  if (/[\u4e00-\u9fff]/.test(issue.message)) return issue.message;

  const value = key && raw && typeof raw === "object" ? (raw as Record<string, unknown>)[key] : undefined;
  const actual = typeof value === "string" ? value.length : null;

  switch (issue.code) {
    case "too_big": {
      if (issue.origin !== "string") return label ? `${label}超過允許的範圍` : null;
      const now = actual === null ? "" : `（目前 ${actual.toLocaleString()} 字）`;
      return `${label || "這個欄位"}最多 ${Number(issue.maximum).toLocaleString()} 字${now}`;
    }
    case "too_small": {
      if (issue.origin !== "string") return label ? `${label}不能小於 ${issue.minimum}` : null;
      return Number(issue.minimum) <= 1
        ? `請填寫${label || "這個欄位"}`
        : `${label || "這個欄位"}至少要 ${issue.minimum} 個字`;
    }
    case "invalid_format":
      if (issue.format === "url") return `${label || "網址"}要填完整網址，開頭要有 https://`;
      if (issue.format === "email") return "Email 格式不正確";
      return label ? `${label}格式不正確` : null;
    case "invalid_type":
      return label ? `請填寫${label}` : null;
    case "invalid_value":
      return label ? `${label}的選項不正確` : null;
    default:
      return null;
  }
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
    const issues = parsed.error.issues;
    // First issue that can be explained wins; if none can, fall back to the
    // registry line rather than showing the user raw English from zod.
    const explained = issues.map((i) => describeIssue(i, raw)).find((m): m is string => !!m);
    throw new ApiError("VALIDATION_ERROR", {
      ...(explained ? { message: explained } : {}),
      issues: issues.map((i) => ({ path: i.path.join("."), message: i.message })),
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
