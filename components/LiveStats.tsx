"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";

type Stats = { shared: number; sent: number; members: number };

// Live headline numbers on the landing page — refreshes every 30s.
export function LiveStats() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiFetch<Stats>("/api/v1/stats/public")
        .then((d) => {
          if (alive) setS(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const fmt = (n?: number) => (n ?? 0).toLocaleString("en-US");
  const items: { label: string; value?: number }[] = [
    { label: "已上架好券", value: s?.shared },
    { label: "成功送出", value: s?.sent },
    { label: "一起分享的人", value: s?.members },
  ];

  return (
    <div className="mt-8 grid max-w-md grid-cols-3 gap-2.5">
      {items.map((x) => (
        <div key={x.label} className="rounded-2xl border border-line bg-paper/70 px-2 py-3 text-center">
          <p className="font-display text-[26px] font-extrabold leading-none text-accent tabular-nums">
            {s ? fmt(x.value) : "…"}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{x.label}</p>
        </div>
      ))}
    </div>
  );
}
