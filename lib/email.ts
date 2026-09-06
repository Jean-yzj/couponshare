// 寄信能力。這個平台在 2026-09-06 之前一封信都寄不出去——忘記密碼是後台產一次性
// 連結、由管理員手動傳給對方，而有 529 位使用者是用 Email＋密碼註冊的。
//
// 供應商包在這一層後面，換掉只要改這個檔。目前用 Resend：免費額度每月 3,000 封、
// 每日 100 封，正好和「新寄件網域要慢慢暖機」的最佳實務一致（一次灌爆會直接進
// 垃圾桶，而且會連累 lazybearlife.com 底下其他三十幾個專案的網域信譽）。
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export type EmailResult = { ok: boolean; id?: string; error?: string };

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// 未設定時回傳失敗但「不丟例外」：寄信是附加能力，不能讓沒設定好就把註冊、
// 忘記密碼這些主要流程一起弄壞。呼叫端自己決定要不要在意結果。
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    console.warn("[email] not configured, skipped:", args.subject);
    return { ok: false, error: "not_configured" };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: ctl.signal,
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      // 收件人位址不要進 log：這是個資，而 log 會被留存與轉寄。
      console.error("[email] send failed", res.status, body?.message ?? "");
      return { ok: false, error: body?.message ?? `http_${res.status}` };
    }
    return { ok: true, id: body?.id };
  } catch (e) {
    console.error("[email] send threw", e instanceof Error ? e.name : String(e));
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}

// 版型。刻意做得樸素：純文字為主、單一連結、沒有圖片和追蹤像素。
// 花俏的 HTML 信對新網域的送達率是負分，而且這些都是交易性通知不是行銷。
export function renderEmail(opts: {
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
}): { html: string; text: string } {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = opts.lines.map((l) => `<p style="margin:0 0 14px;line-height:1.7">${esc(l)}</p>`).join("");
  const button = opts.action
    ? `<p style="margin:24px 0"><a href="${esc(opts.action.url)}" style="display:inline-block;background:#1f6f5c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${esc(opts.action.label)}</a></p>
       <p style="margin:0 0 14px;color:#6b6b6b;font-size:13px;line-height:1.6">按鈕打不開的話，把這串網址複製到瀏覽器：<br>${esc(opts.action.url)}</p>`
    : "";
  const footer = opts.footer
    ? `<p style="margin:28px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6">${esc(opts.footer)}</p>`
    : "";

  const html = `<div style="font-family:-apple-system,'Noto Sans TC','PingFang TC',sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#2b2b2b;font-size:15px">
<h1 style="margin:0 0 18px;font-size:19px">${esc(opts.heading)}</h1>
${body}${button}${footer}
<p style="margin:24px 0 0;color:#8a8a8a;font-size:12px">CouponShare · 把用不到的券傳給需要的人</p>
</div>`;

  const text = [
    opts.heading,
    "",
    ...opts.lines,
    ...(opts.action ? ["", `${opts.action.label}：${opts.action.url}`] : []),
    ...(opts.footer ? ["", opts.footer] : []),
    "",
    "CouponShare · 把用不到的券傳給需要的人",
  ].join("\n");

  return { html, text };
}
