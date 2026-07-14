import type { NextRequest } from "next/server";

// Private / loopback / link-local ranges — these are our own proxy hops, never the
// real client, so we skip them when reading X-Forwarded-For.
function isPrivate(ip: string): boolean {
  if (
    ip.startsWith("10.") ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.")
  ) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip)) return true;
  return false;
}

// Real client IP, hardened against X-Forwarded-For spoofing. A client can PREPEND
// fake entries, but every trusted proxy APPENDS the address it actually saw — so the
// right-most PUBLIC entry is the one our infrastructure added, not attacker-chosen.
// (Taking split(",")[0] — the left-most — trusts whatever the client claimed.)
export function clientIp(req: NextRequest): string | null {
  // Behind Cloudflare, CF-Connecting-IP is the authoritative real-client address —
  // Cloudflare sets it at the edge and it cannot be forged through the proxy. We MUST
  // prefer it: once CF is in front, the right-most PUBLIC entry of X-Forwarded-For is
  // Cloudflare's *edge egress* IP (a small shared pool), so the XFF logic below would
  // collapse thousands of distinct users onto a handful of IPs — one shared rate-limit
  // bucket (mass false "操作太頻繁" on register/login) and one blocked user poisoning a
  // whole edge. cf-connecting-ip restores true per-client keying.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && !isPrivate(cf)) return cf;

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!isPrivate(parts[i]!)) return parts[i]!;
    }
    if (parts.length) return parts[parts.length - 1]!; // all private (unusual)
  }
  return req.headers.get("x-real-ip") || null;
}
