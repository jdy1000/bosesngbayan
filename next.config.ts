import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Classic dynamic rendering: CMS reads are always fresh and builds never need a live database.
  // See docs/ARCHITECTURE.md (ADR-004).
  cacheComponents: false,
  poweredByHeader: false,
  // Media uploads post one file (≤ MAX_UPLOAD_BYTES = 4 MB) per server action; default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol === "http:" ? "http" : "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Local Supabase serves media from 127.0.0.1, which the optimizer blocks as an SSRF guard.
    // Allowed only when the configured Supabase host is itself loopback; remotePatterns still pins host/port/path.
    dangerouslyAllowLocalIP: supabaseUrl ? ["127.0.0.1", "localhost", "[::1]"].includes(supabaseUrl.hostname) : false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
