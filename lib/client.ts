"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiErr extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(opts.headers || {}),
    },
    credentials: "same-origin",
  });
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

export function useApi<T = unknown>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<ApiErr | null>(null);

  const refetch = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<T>(path));
    } catch (e) {
      setError(e as ApiErr);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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
  must_share_first?: boolean;
};

export function useMe() {
  const { data, loading, refetch } = useApi<{ user: Me | null }>("/api/v1/auth/me");
  return { me: data?.user ?? null, loading, refetch };
}
