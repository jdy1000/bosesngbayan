/**
 * Two-origin deployment (ARCHITECTURE.md ADR-020). The public site and Studio are one build served on two
 * origins: NEXT_PUBLIC_SITE_URL for readers and NEXT_PUBLIC_ADMIN_URL for Studio. This only decides which
 * origin shows a page; every Studio page, action and RPC still checks permissions on the server.
 *
 * Returns the absolute URL a page request must be redirected to, or null when it is already on the right
 * origin. With NEXT_PUBLIC_ADMIN_URL unset or equal to the site origin (local development) nothing moves.
 */
export function crossHostRedirect(
  host: string,
  pathname: string,
  search: string,
  siteBase: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  adminBase: string | undefined = process.env.NEXT_PUBLIC_ADMIN_URL,
): string | null {
  if (!siteBase || !adminBase) return null;
  let site: URL;
  let admin: URL;
  try {
    site = new URL(siteBase);
    admin = new URL(adminBase);
  } catch {
    return null; // invalid config is reported by env validation elsewhere
  }
  if (site.host === admin.host) return null;

  // Exact segment match, so a public slug such as /administrasyon is never treated as Studio.
  const studio = pathname === "/admin" || pathname.startsWith("/admin/");
  const onAdminHost = host.toLowerCase() === admin.host;
  if (onAdminHost && !studio) return pathname === "/" ? `${admin.origin}/admin` : `${site.origin}${pathname}${search}`;
  if (!onAdminHost && studio) return `${admin.origin}${pathname}${search}`;
  return null;
}
