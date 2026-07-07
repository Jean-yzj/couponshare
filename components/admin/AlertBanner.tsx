"use client";

type Alert = { severity: "red" | "yellow"; key: string; message: string };

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.key}
          className={
            a.severity === "red"
              ? "flex items-start gap-2 rounded-xl border border-danger/40 bg-danger-tint/70 px-4 py-3 text-sm text-danger"
              : "flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-50/70 px-4 py-3 text-sm text-amber-800"
          }
        >
          <svg
            className="mt-0.5 h-4 w-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 2L14.5 13.5H1.5L8 2Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <line x1="8" y1="6.5" x2="8" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  );
}
