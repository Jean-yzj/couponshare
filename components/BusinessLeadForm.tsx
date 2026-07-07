"use client";

import { useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
import { Button, Card, Eyebrow, Field, Input } from "@/components/ui";
import { Icon } from "@/components/icons";

// 企業合作窗口 — collects the four contact fields; the founder replies with a quote
// by email. Reused both standalone and as the closing section of the /business
// pitch page (hence the configurable heading).
export function BusinessLeadForm({
  title = "企業合作窗口",
  subtitle = "想把品牌優惠以「官方福利券」的形式放上 CouponShare？留下聯絡方式，我會把完整的合作方案與報價寄到你的信箱。",
}: {
  title?: string;
  subtitle?: string;
} = {}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || !phone.trim() || !lineId.trim()) {
      setError("四個欄位都需要填寫，我才聯絡得到你。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/business-leads", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          line_id: lineId.trim(),
        }),
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "送出失敗，請再試一次");
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pine-tint text-pine">
          <Icon name="checkCircle" size={28} />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">已收到你的資料</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">
          謝謝你的興趣！我會盡快把企業合作報價寄到 <span className="font-medium text-ink">{email.trim()}</span>
          ，也可能透過 LINE 與你聯繫。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="text-center">
        <Eyebrow>
          <Icon name="sparkle" size={13} /> Business · 企業合作
        </Eyebrow>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-2.5 max-w-sm text-[15px] leading-relaxed text-ink-soft">{subtitle}</p>
      </div>

      <Card className="mt-6 space-y-4 p-5 sm:p-6">
        <Field label="姓名" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="怎麼稱呼你"
            maxLength={40}
            autoComplete="name"
          />
        </Field>
        <Field label="Email" required hint="報價會寄到這個信箱">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            maxLength={120}
            autoComplete="email"
          />
        </Field>
        <Field label="電話" required>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912 345 678"
            maxLength={20}
            autoComplete="tel"
          />
        </Field>
        <Field label="LINE ID" required>
          <Input
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            placeholder="方便即時聯繫"
            maxLength={80}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button full size="lg" icon="send" loading={busy} onClick={submit}>
          送出資料
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-faint">
          你留下的資料只會用於這次合作洽談的聯繫，不會作其他用途。
        </p>
      </Card>
    </div>
  );
}
