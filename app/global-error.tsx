"use client";

// Last-resort boundary (errors thrown by the root layout itself). Must render
// its own <html>/<body> per Next.js contract. Same stale-build auto-recovery
// as app/error.tsx, inlined because layout styles may not be available here.
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    const s = `${error.name} ${error.message}`;
    if (!/chunk|dynamically imported module|fetch.*failed|NetworkError|text\/html/i.test(s)) return;
    const KEY = "cs-reloaded-once";
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    window.location.reload();
  }, [error]);

  return (
    <html lang="zh-Hant">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f2f7ff", color: "#142140" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>頁面載入出了點問題</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#566388", lineHeight: 1.6 }}>
            可能是網站剛更新完成，重新整理一下通常就會恢復。
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem("cs-reloaded-once");
              window.location.reload();
            }}
            style={{
              marginTop: 24,
              padding: "10px 28px",
              borderRadius: 999,
              border: 0,
              background: "linear-gradient(135deg,#3b93ff,#0e60e6)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            重新整理
          </button>
        </div>
      </body>
    </html>
  );
}
