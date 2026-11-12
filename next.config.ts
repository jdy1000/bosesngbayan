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
  // experimental.inlineCss was measured and left off: it writes the CSS into the HTML twice (38 KB -> 88 KB), which slows first paint.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  productionBrowserSourceMaps: false,
  images: {
    // AVIF first (smaller than WebP for photographs); browsers without it get WebP.
    formats: ["image/avif", "image/webp"],
    // Story photos ask for 60; everything else keeps the default 75. Next only serves the values listed here.
    qualities: [60, 75],
    // An uploaded file never changes under the same storage path, so its optimized copies can be kept for 31 days.
    minimumCacheTTL: 2678400,
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
