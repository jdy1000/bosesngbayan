import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 proxy (formerly middleware).
 * 1. Every page: a per-request nonce Content-Security-Policy (Next applies the nonce to its own
 *    scripts; all pages render dynamically, see ARCHITECTURE.md ADR-004).
 * 2. /admin/*: refresh the Supabase session cookie and send signed-out visitors to the login page
 *    (a UX redirect — every Studio page, action and RPC still enforces permissions server-side).
 * Public pages never touch the session, so they cannot leak drafts.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes/tags (brand variables, next/font, TipTap) — no script execution risk.
    "style-src 'self' 'unsafe-inline'",
    // The configured Supabase origin is listed explicitly so Studio thumbnails also load from a local http stack.
    `img-src 'self' data: blob: https: ${supabase}${dev ? " http:" : ""}`.trimEnd(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${dev ? " ws:" : ""}`.trim(),
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  const path = request.nextUrl.pathname;
  // Exact segment match, so a public slug such as /administrasyon is never treated as Studio.
  const studio = path === "/admin" || path.startsWith("/admin/");
  // Lets the root layout pick <html lang>: Studio is English-only, the public site follows the reader's language.
  request.headers.set("x-bnb-area", studio ? "studio" : "site");
  if (!studio) return withCsp(NextResponse.next({ request }));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let nextResponse = NextResponse.next({ request });
  if (!url || !key) return withCsp(nextResponse);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        nextResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) nextResponse.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  const isPublicAdminPath = path === "/admin/login" || path === "/admin/apply" || path.startsWith("/admin/auth/");
  if (!data.user && !isPublicAdminPath) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    return withCsp(NextResponse.redirect(login));
  }
  nextResponse.headers.set("Cache-Control", "private, no-store");
  nextResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  return withCsp(nextResponse);
}

export const config = {
  // Pages only: skip API routes, Next internals, and static files (anything with an extension).
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
