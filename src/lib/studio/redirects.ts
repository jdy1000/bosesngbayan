import { z } from "zod";
import { safeHref } from "@/lib/homepage/blocks";

/** Paths the redirect layer must never shadow. */
const RESERVED = /^\/(admin|api|_next)(\/|$)/i;

export const REDIRECT_STATUS_CODES = [301, 302, 307, 308] as const;

export const redirectInputSchema = z
  .object({
    source_path: z
      .string()
      .trim()
      .max(300, "Up to 300 characters.")
      .regex(/^\/[^/\s?#][^\s?#]*$/, "The source must be a path starting with / (no query, # or spaces).")
      .refine((v) => !RESERVED.test(v), { message: "/admin, /api and /_next cannot be redirected." }),
    destination: safeHref.refine((v) => !/\s/.test(v), { message: "The destination cannot contain spaces." }),
    status_code: z.coerce
      .number()
      .refine((c) => (REDIRECT_STATUS_CODES as readonly number[]).includes(c), { message: "301, 302, 307 or 308 only." }),
    is_active: z.boolean(),
  })
  .refine((v) => v.source_path !== v.destination, { message: "A path cannot redirect to itself.", path: ["destination"] });

/** Normalise a destination to a same-site path when it points at our own origin; null for external URLs. */
export function sameSitePath(destination: string, siteOrigin: string): string | null {
  if (destination.startsWith("/")) return destination.split(/[?#]/)[0] || "/";
  try {
    const url = new URL(destination);
    return url.origin === siteOrigin ? url.pathname : null;
  } catch {
    return null;
  }
}

/**
 * Follow active redirects from `destination` and report whether they lead back to `source`
 * (A→A, A→B→A, A→B→C→A …). `existing` must exclude the redirect being edited.
 */
export function createsLoop(
  source: string,
  destination: string,
  existing: { source_path: string; destination: string }[],
  siteOrigin: string,
  maxHops = 20,
): boolean {
  const next = new Map(existing.map((r) => [r.source_path, r.destination]));
  let current = sameSitePath(destination, siteOrigin);
  for (let hop = 0; current !== null && hop <= maxHops; hop++) {
    if (current === source) return true;
    const dest = next.get(current);
    if (dest === undefined) return false;
    current = sameSitePath(dest, siteOrigin);
  }
  return current !== null; // chain longer than maxHops: treat as a loop to be safe
}
