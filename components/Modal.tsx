"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/display";
import { IconButton } from "./ui";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-paper shadow-lift animate-pop sm:rounded-3xl",
          widths[size],
        )}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-3.5 backdrop-blur">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <IconButton name="x" label="關閉" onClick={onClose} />
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
