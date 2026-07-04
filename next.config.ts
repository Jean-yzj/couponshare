import type { NextConfig } from "next";

// Baseline security headers (defense-in-depth). The audit found no XSS sinks, so
// the CSP keeps 'unsafe-inline' for scripts/styles that Next's hydration needs,
// while still locking down framing, object/base injection, and MIME sniffing.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
