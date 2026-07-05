export const UTM_STORAGE_KEY = "cs-utm";
export const UTM_COOKIE = "cs_utm";

export type UtmPayload = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_path?: string;
};

const LIMITS: Record<keyof UtmPayload, number> = {
  utm_source: 80,
  utm_medium: 80,
  utm_campaign: 120,
  utm_content: 160,
  utm_term: 120,
  landing_path: 300,
};

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().replace(/\s+/g, " ");
  return v ? v.slice(0, max) : undefined;
}

export function normalizeUtm(input: unknown): UtmPayload {
  if (!input || typeof input !== "object") return {};
  const src = input as Record<string, unknown>;
  const out: UtmPayload = {};
  for (const key of KEYS) {
    const v = clean(src[key], LIMITS[key]);
    if (v) out[key] = v;
  }
  const landing = clean(src.landing_path, LIMITS.landing_path);
  if (landing) out.landing_path = landing;
  return out;
}

export function utmCreateData(input: unknown) {
  const utm = normalizeUtm(input);
  return {
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    utmContent: utm.utm_content,
    utmTerm: utm.utm_term,
    landingPath: utm.landing_path,
  };
}

export function utmFromSearchParams(params: URLSearchParams, pathname = ""): UtmPayload {
  const out: UtmPayload = {};
  for (const key of KEYS) {
    const v = clean(params.get(key), LIMITS[key]);
    if (v) out[key] = v;
  }
  if (Object.keys(out).length > 0) {
    const query = params.toString();
    out.landing_path = clean(`${pathname}${query ? `?${query}` : ""}`, LIMITS.landing_path);
  }
  return out;
}

export function utmToQuery(utm: UtmPayload): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const v = utm[key];
    if (v) params.set(key, v);
  }
  if (utm.landing_path) params.set("landing_path", utm.landing_path);
  return params.toString();
}
