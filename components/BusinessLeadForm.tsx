"use client";

import { useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
import { Button, Card, Eyebrow, Field, Input } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";

const GOALS = ["品牌曝光", "導流到店 / 到站", "新品試用", "會員招募 / 名單", "折扣碼推廣", "活動報名"];
const CATEGORIES = ["超商", "咖啡", "手搖飲", "甜點", "速食", "餐廳", "零售 / 電商", "課程 / 教育", "App / 服務", "其他"];

// 企業合作窗口 — collects contact + qualifying info (company, title, goals,
// categories); the founder replies with a quote by email. Reused standalone and as
// the closing section of the /business pitch page (hence the configurable heading).
export function BusinessLeadForm({
  title = "企業合作窗口",
  subtitle = "想把品牌優惠以「官方福利券」的形式放上 CouponShare？留下聯絡方式，我會把完整的合作方案與報價寄到你的信箱。",
  plan = null,
  onPlanChange,
  planOptions,
}: {
  title?: string;
  subtitle?: string;
  plan?: string | null;
  onPlanChange?: (p: string | null) => void;
  planOptions?: string[];
} = {}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit() {
    if (!company.trim() || !name.trim() || !email.trim()) {
      setError("請至少填品牌名稱、姓名與 Email。");
      return;
    }
    if (goals.length === 0) {
      setError("請至少選一個合作目標，我才能給你合適的方案。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/business-leads", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          job_title: jobTitle.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          line_id: lineId.trim() || undefined,
          plan: plan?.trim() || undefined,
          goals,
          categories,
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
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">已收到你的資料</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">
          謝謝你的興趣！我會盡快把量身的合作方案與報價寄到 <span className="font-medium text-ink">{email.trim()}</span>
          ，也可能透過 LINE 與你聯繫。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="text-center">
        <Eyebrow>
          <Icon name="sparkle" size={13} /> Get in touch
        </Eyebrow>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h2>
        <p className="mx-auto mt-2.5 max-w-md text-[15px] leading-relaxed text-ink-soft">{subtitle}</p>
      </div>

      <Card className="mt-6 space-y-5 p-5 sm:p-7">
        {planOptions && planOptions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-ink">
              你想了解的方案 <span className="font-normal text-ink-faint">（選填，可更改）</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {planOptions.map((o) => {
                const on = plan === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => onPlanChange?.(on ? null : o)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      on
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-paper text-ink-soft hover:border-accent/40 hover:text-ink",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="公司 / 品牌名稱" required>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="例如：某某咖啡" maxLength={60} autoComplete="organization" />
          </Field>
          <Field label="姓名" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="怎麼稱呼你" maxLength={40} autoComplete="name" />
          </Field>
          <Field label="Email" required hint="方案與範例報表會寄到這裡">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" maxLength={120} autoComplete="email" />
          </Field>
          <Field label="職稱" hint="選填">
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="例如：行銷經理" maxLength={40} autoComplete="organization-title" />
          </Field>
          <Field label="電話" hint="選填">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 345 678" maxLength={20} autoComplete="tel" />
          </Field>
          <Field label="LINE ID" hint="選填">
            <Input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="方便即時聯繫" maxLength={80} />
          </Field>
        </div>

        <CheckGroup label="這次的合作目標（可複選，必填）" options={GOALS} selected={goals} onToggle={(v) => toggle(goals, setGoals, v)} />
        <CheckGroup label="你的產品分類（可複選）" options={CATEGORIES} selected={categories} onToggle={(v) => toggle(categories, setCategories, v)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button full size="lg" icon="send" loading={busy} onClick={submit}>
          送出，取得方案與範例報表
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-faint">
          你留下的資料只會用於這次合作洽談的聯繫，不會作其他用途。
        </p>
      </Card>
    </div>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-paper text-ink-soft hover:border-accent/40 hover:text-ink",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
