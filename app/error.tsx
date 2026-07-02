"use client";

import { useEffect } from "react";

// After every deploy, tabs opened on the previous build request old hashed
// chunks that no longer exist — navigation then throws a chunk-load error and
// the page goes blank. Detect that case and hard-reload once to pick up the
// new build; anything else gets a visible retry UI instead of a dead page.
function isStaleBuildError(err: Error): boolean {
  const s = `${err.name} ${err.message}`;
  return /chunk|Loading chunk|dynamically imported module|import\(\)|fetch.*failed|NetworkError|text\/html/i.test(s);
}

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (!isStaleBuildError(error)) return;
    const KEY = "cs-reloaded-once";
    if (sessionStorage.getItem(KEY)) return; // avoid reload loops
    sessionStorage.setItem(KEY, "1");
    window.location.reload();
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-tint text-accent">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-ink">頁面載入出了點問題</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        可能是網站剛更新完成。重新整理一下通常就會恢復。
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => {
            sessionStorage.removeItem("cs-reloaded-once");
            window.location.reload();
          }}
          className="rounded-full bg-grad-brand px-6 py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          重新整理
        </button>
        <button
          onClick={reset}
          className="rounded-full border border-line bg-paper px-6 py-2.5 text-sm font-semibold text-ink"
        >
          再試一次
        </button>
      </div>
    </div>
  );
}
