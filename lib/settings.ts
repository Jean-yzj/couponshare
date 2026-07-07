import { prisma } from "./db";

// Operational flags read on hot paths (claim, register). Cache in-process for a few
// seconds so we don't hit the DB every request; a toggle propagates across the fleet
// within CACHE_MS, which is fine for a kill-switch. The instance that flips it busts
// its own cache immediately.
const CACHE_MS = 8_000;
let cache: Record<string, string> = {};
let cachedAt = 0;

async function load(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedAt && now - cachedAt < CACHE_MS) return cache;
  try {
    const rows = await prisma.appSetting.findMany();
    cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    cachedAt = now;
  } catch {
    // If settings can't be read, fail OPEN (don't accidentally lock the platform).
  }
  return cache;
}

export async function getFlag(key: string): Promise<boolean> {
  return (await load())[key] === "1";
}

export async function getFlags(keys: string[]): Promise<Record<string, boolean>> {
  const c = await load();
  return Object.fromEntries(keys.map((k) => [k, c[k] === "1"]));
}

export async function setFlag(key: string, on: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: on ? "1" : "0" },
    update: { value: on ? "1" : "0" },
  });
  cachedAt = 0; // bust cache so this instance reflects the change immediately
}

export const FLAG_CLAIMS_PAUSED = "claims_paused";
export const FLAG_REGISTER_PAUSED = "register_paused";
// Master switch for the whole enterprise brand-coupon surface. Default OFF: while
// off, brand coupons are invisible to regular users (admins can still preview).
export const FLAG_BRAND_COUPONS = "brand_coupons_enabled";
