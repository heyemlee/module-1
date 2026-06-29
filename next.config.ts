import type { NextConfig } from "next";
import path from "path";

// Baseline security headers applied to every response.
// ponytail: script/style allow 'unsafe-inline' because Next's runtime injects
// inline bootstrap without nonces by default — tighten to a nonce/'strict-dynamic'
// CSP only if you adopt Next's middleware-nonce setup. img allows data:/blob: for
// the in-memory rendering preview before it's persisted to the same-origin route.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ""}`.trim(),
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HSTS is honored only over HTTPS (browsers ignore it on plain HTTP), so it's
  // safe to send everywhere; no `preload` — that commitment is hard to undo.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Rewrite barrel imports (icon set, motion) to direct deep imports so only
    // the modules actually used get bundled.
    optimizePackageImports: ["@radix-ui/react-icons", "motion"]
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
