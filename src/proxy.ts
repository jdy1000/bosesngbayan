import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { crossHostRedirect, isStudioPath, STUDIO_HOME } from "@/lib/host-routing";

/**
 * Next 16 proxy (formerly middleware).
 * 0. Two-origin deployments: a Studio path on the public host, or a public path on the Studio host,
 *    is redirected to the other origin (ADR-020). A single host (local development) is untouched.
 *    /admin itself redirects to the Overview's address, /dashboard (ADR-022).
 * 1. Every page: a per-request nonce Content-Security-Policy (Next applies the nonce to its own
 *    scripts; all pages render dynamically, see ARCHITECTURE.md ADR-004).
 * 2. Studio pages (/dashboard and /admin/*): refresh the Supabase session cookie and send signed-out
 *    visitors to the login page (a UX redirect — every Studio page, action and RPC still enforces
 *    permissions server-side).
 * Public pages never touch the session, so they cannot leak drafts.
 */

/** A redirect target on the host the visitor used: nextUrl can carry the server's own host instead. */
function sameHostUrl(request: NextRequest, pathname: string, search: string): URL {
  const url = request.nextUrl.clone();
  url.host = request.headers.get("host") ?? url.host;
  url.pathname = pathname;
  url.search = search;
  return url;
}

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
  const otherOrigin = crossHostRedirect(request.headers.get("host") ?? request.nextUrl.host, request.nextUrl.pathname, request.nextUrl.search);
  if (otherOrigin) return NextResponse.redirect(otherOrigin);
  // Old bookmarks and links to /admin land on the Overview's new address, with their query (?denied=1, date range).
  if (request.nextUrl.pathname === "/admin") return NextResponse.redirect(sameHostUrl(request, STUDIO_HOME, request.nextUrl.search));

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  const path = request.nextUrl.pathname;
  const studio = isStudioPath(path);
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
  if (!data.user && !isPublicAdminPath) return withCsp(NextResponse.redirect(sameHostUrl(request, "/admin/login", "")));
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
