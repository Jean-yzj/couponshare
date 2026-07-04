const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// Outbound calls to Google MUST have a deadline: Node fetch has none by default,
// so a stalled connection from the host leaves the user's browser hanging forever
// on a blank callback page. Timing out throws → callback redirects to
// /login?error=google_failed, which the user can simply retry.
function withDeadline(ms: number): AbortSignal {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  (t as unknown as { unref?: () => void }).unref?.();
  return ctl.signal;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: withDeadline(10_000),
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    // Preserve Google's error code (invalid_client / redirect_uri_mismatch /
    // invalid_grant) so the callback can surface *which* thing broke.
    const body = await res.text().catch(() => "");
    throw new Error(`token_exchange ${res.status} ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("no access token");
  return data.access_token;
}

export async function fetchGoogleProfile(
  accessToken: string,
): Promise<{ sub: string; email: string; name: string; picture: string | null }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: withDeadline(10_000),
  });
  if (!res.ok) throw new Error("google profile fetch failed");
  const p = (await res.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  return { sub: p.sub, email: p.email ?? "", name: p.name || p.email || "Google 使用者", picture: p.picture ?? null };
}
