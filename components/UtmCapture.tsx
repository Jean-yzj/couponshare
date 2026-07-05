"use client";

import { useEffect } from "react";
import { UTM_STORAGE_KEY, utmFromSearchParams } from "@/lib/utm";

export function UtmCapture() {
  useEffect(() => {
    const utm = utmFromSearchParams(new URLSearchParams(window.location.search), window.location.pathname);
    if (Object.keys(utm).length === 0) return;
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    } catch {
      /* storage unavailable — attribution gracefully falls back to direct. */
    }
  }, []);

  return null;
}
