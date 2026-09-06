import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, publicOrigin } from "@/lib/api";
import { generateToken, hashToken } from "@/lib/crypto";
import { forgotPasswordSchema } from "@/lib/validation";
import { throttle } from "@/lib/throttle";
import { writeAudit } from "@/lib/audit";
import { isEmailConfigured, sendEmail, renderEmail } from "@/lib/email";

export const runtime = "nodejs";

const TTL_HOURS = 24;

// Self-serve "forgot password". The token machinery is the same one the admin
// route has always used (one-time, hashed at rest, 24h, one live link per user);
// what was missing was the user being able to start it themselves — until now
// they had to message the admin, who generated a link and passed it over by hand.
//
// The response is deliberately identical whether or not the address has an
// account. Anything else turns this into an oracle for "is this person a user
// here", and a coupon-sharing account is not something to leak membership of.
export const POST = route(async (req) => {
  throttle(req, "forgot-password", 5, 60 * 60_000);
  const { email } = await readBody(req, forgotPasswordSchema);

  // email_enabled describes the platform, not the account, so surfacing it leaks
  // nothing — and without it the UI would have to claim "the mail is on its way"
  // during any window where sending isn't set up, which is simply untrue.
  const configured = isEmailConfigured();
  const same = jsonOk({ ok: true, email_enabled: configured });
  if (!configured) return same;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, displayName: true, loginProvider: true, status: true },
  });
  if (!user || !user.email || user.status !== "ACTIVE") return same;

  // A Google-created account has no password to reset. Say so in the mail rather
  // than silently doing nothing — only the address owner receives it, so this
  // helps the person without telling anyone else anything.
  if (user.loginProvider !== "EMAIL") {
    const { html, text } = renderEmail({
      heading: "你的 CouponShare 帳號是用 Google 登入的",
      lines: [
        `${user.displayName} 你好，`,
        "我們收到這個信箱的密碼重設要求，但這個帳號當初是用 Google 建立的，沒有密碼可以重設。",
        "請在登入頁按「使用 Google 繼續」就能直接進去。",
      ],
      action: { label: "前往登入", url: `${publicOrigin(req)}/login` },
      footer: "如果這不是你本人操作，可以忽略這封信，你的帳號沒有任何變動。",
    });
    await sendEmail({ to: user.email, subject: "CouponShare 登入方式說明", html, text });
    return same;
  }

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = generateToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
    },
  });

  const { html, text } = renderEmail({
    heading: "重設你的 CouponShare 密碼",
    lines: [
      `${user.displayName} 你好，`,
      `我們收到你的密碼重設要求。點下面的按鈕就能設定新密碼，連結 ${TTL_HOURS} 小時內有效，而且只能用一次。`,
    ],
    action: { label: "設定新密碼", url: `${publicOrigin(req)}/reset-password?token=${token}` },
    footer: "如果這不是你本人操作，可以忽略這封信，你的密碼不會有任何變動。",
  });
  const sent = await sendEmail({ to: user.email, subject: "重設你的 CouponShare 密碼", html, text });

  // Audit the request, not the token. If sending is broken we need to be able to
  // tell "nobody asked" apart from "everybody asked and the mail never went out".
  await writeAudit(prisma, {
    action: "user.password_reset_requested",
    targetType: "user",
    targetId: user.id,
    after: { delivered: sent.ok, error: sent.ok ? undefined : sent.error },
  });

  return same;
});
