import { NextResponse } from "next/server";

// Unified error registry — PRD §14. Messages in zh-Hant.
export const ERROR_REGISTRY = {
  UNAUTHORIZED: { status: 401, message: "尚未登入" },
  INVALID_CREDENTIALS: { status: 401, message: "帳號或密碼錯誤" },
  PASSWORD_LOGIN_UNAVAILABLE: { status: 409, message: "這個 Email 是用 Google 建立的，請按「使用 Google 繼續」登入" },
  FORBIDDEN: { status: 403, message: "權限不足" },
  USER_SUSPENDED: { status: 403, message: "帳號已被停權" },
  EMAIL_TAKEN: { status: 409, message: "此 Email 已被註冊" },
  VALIDATION_ERROR: { status: 400, message: "輸入資料有誤" },
  NOT_FOUND: { status: 404, message: "找不到資源" },
  COUPON_NOT_FOUND: { status: 404, message: "找不到優惠券" },
  COUPON_EXPIRED: { status: 409, message: "優惠券已過期" },
  COUPON_ALREADY_CLAIMED: { status: 409, message: "此優惠券已被領取" },
  COUPON_NOT_AVAILABLE: { status: 409, message: "優惠券目前不可申請" },
  CANNOT_CLAIM_OWN_COUPON: { status: 403, message: "不可申請自己的優惠券" },
  DUPLICATE_CLAIM_REQUEST: { status: 409, message: "已經申請過此優惠券" },
  CLAIM_REQUEST_NOT_FOUND: { status: 404, message: "找不到申請紀錄" },
  INVALID_STATUS_TRANSITION: { status: 409, message: "不允許的狀態轉換" },
  DAILY_CLAIM_LIMIT_EXCEEDED: { status: 429, message: "今日申請額度已用完，分享一張券就能再 +3 次申請機會！" },
  DAILY_CLAIM_HARD_CAP: { status: 429, message: "今日申請已達每日上限，明天再來看看新的好康吧！" },
  SHARE_FIRST: { status: 403, message: "為了讓好康流動，先分享一張你用不到的券給大家，就能繼續申請囉！" },
  DAILY_PUBLISH_LIMIT_EXCEEDED: { status: 429, message: "已超過今日上架上限" },
  RATE_LIMITED: { status: 429, message: "操作太頻繁，請稍後再試" },
  BARCODE_ACCESS_DENIED: { status: 403, message: "無權查看條碼" },
  BARCODE_NOT_READY: { status: 409, message: "此優惠券尚未上傳條碼" },
  REPORT_ALREADY_EXISTS: { status: 409, message: "已檢舉過此項目" },
  RATING_ALREADY_EXISTS: { status: 409, message: "已評價過此交易" },
  TRANSACTION_NOT_COMPLETE: { status: 409, message: "交易尚未完成，無法評價" },
  INTERNAL: { status: 500, message: "伺服器發生錯誤" },
} as const;

export type ErrorCode = keyof typeof ERROR_REGISTRY;

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details: Record<string, unknown>;

  constructor(code: ErrorCode, details: Record<string, unknown> = {}) {
    const entry = ERROR_REGISTRY[code];
    super(entry.message);
    this.code = code;
    this.status = entry.status;
    this.details = details;
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  console.error("[unhandled]", err);
  const entry = ERROR_REGISTRY.INTERNAL;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: entry.message, details: {} } },
    { status: entry.status },
  );
}
