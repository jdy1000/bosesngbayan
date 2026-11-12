/** Where a person is sent when their session did not come from a fresh emailed link. */
export const LINK_EXPIRED_URL = "/admin/login?recovery=1&error=expired";

// Authentication methods that Supabase Auth can record for a session opened from an emailed link.
const LINK_METHODS = new Set(["recovery", "invite", "otp", "magiclink"]);
const MAX_AGE_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 30;

/**
 * True when the verified access token's `amr` claim holds a link-based sign-in from the last 15 minutes.
 *
 * auth-js types the claim as `AMREntry[]` ({ method, timestamp in seconds since the epoch }) or, when a custom
 * access-token hook rewrites it, `string[]`. A plain string carries no time, so it never passes: without proof
 * of a recent link this returns false and the caller refuses. Pass claims from `supabase.auth.getClaims()` only.
 */
export function isRecentLinkSession(amr: unknown, now = Date.now() / 1000): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null || !("method" in entry) || !("timestamp" in entry)) return false;
    const { method, timestamp } = entry;
    return (
      typeof method === "string" &&
      LINK_METHODS.has(method) &&
      typeof timestamp === "number" &&
      timestamp <= now + CLOCK_SKEW_SECONDS &&
      timestamp > now - MAX_AGE_SECONDS
    );
  });
}
