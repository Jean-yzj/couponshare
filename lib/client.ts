"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiErr extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

// One attempt with a hard deadline — a hung connection must fail fast so the UI
// can retry, instead of leaving the user on an eternal skeleton.
async function fetchOnce(path: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(path, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const isForm = opts.body instanceof FormData;
  const init: RequestInit = {
    ...opts,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(opts.headers || {}),
    },
    credentials: "same-origin",
  };
  const method = (opts.method || "GET").toUpperCase();

  let res: Response;
  try {
    res = await fetchOnce(path, init, 12_000);
  } catch (e) {
    // Network drop or timeout. GETs are safe to retry once; mutations are not
    // (the first attempt may have landed server-side).
    if (method !== "GET") {
      const err = new ApiErr("連線逾時，請檢查網路後再試");
      err.code = "NETWORK";
      throw err;
    }
    await new Promise((r) => setTimeout(r, 600));
    try {
      res = await fetchOnce(path, init, 12_000);
    } catch {
      const err = new ApiErr("連線逾時，請檢查網路後再試");
      err.code = "NETWORK";
      throw err;
    }
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = data as { error?: { message?: string; code?: string; details?: Record<string, unknown> } };
    const e = new ApiErr(err?.error?.message || "發生錯誤，請稍後再試");
    e.code = err?.error?.code;
    e.status = res.status;
    e.details = err?.error?.details;
    throw e;
  }
  return data as T;
}

// Module-level response cache (stale-while-revalidate): switching tabs renders
// the last-seen data instantly and refreshes silently in the background, instead
// of blanking to a skeleton on every navigation. Lives for the browser session;
// a full page load (login/logout both hard-redirect) resets it.
const apiCache = new Map<string, unknown>();

export function useApi<T = unknown>(path: string | null) {
  const initial = path ? (apiCache.get(path) as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(!!path && initial === undefined);
  const [error, setError] = useState<ApiErr | null>(null);

  const refetch = useCallback(async () => {
    if (!path) return;
    setError(null);
    try {
      const d = await apiFetch<T>(path);
      apiCache.set(path, d);
      setData(d);
    } catch (e) {
      setError(e as ApiErr);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // Path changed or first mount: paint cached data immediately (if any),
    // then revalidate. Only paths never seen before show a loading state.
    const c = path ? (apiCache.get(path) as T | undefined) : undefined;
    setData(c ?? null);
    setError(null);
    setLoading(!!path && c === undefined);
    refetch();
  }, [refetch, path]);

  return { data, loading, error, refetch, setData };
}

export type Me = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  user_level: "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
  level_name: string;
  contribution_score: number;
  monthly_gifts?: number;
  risk_flag: boolean;
  status: string;
  is_admin?: boolean;
  daily_claim_limit: number;
  daily_publish_limit: number;
  next_level: { level: string; name: string; needScore: number; needGifts: number } | null;
  has_shared?: boolean;
  apply_remaining?: number;
  apply_limit?: number;
  apply_base?: number;
  apply_bonus_pool?: number;
  apply_can_share_for_more?: boolean;
  must_share_first?: boolean;
};

export function useMe() {
  const { data, loading, refetch } = useApi<{ user: Me | null }>("/api/v1/auth/me");
  return { me: data?.user ?? null, loading, refetch };
}
