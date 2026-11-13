import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";

export const RATE_LIMITS = {
  vote: { max: 20, windowSeconds: 600 },
  newsletter: { max: 5, windowSeconds: 3600 },
  submission: { max: 3, windowSeconds: 3600 },
  comment: { max: 10, windowSeconds: 3600 },
  report: { max: 10, windowSeconds: 3600 },
  search: { max: 60, windowSeconds: 60 },
  login: { max: 10, windowSeconds: 900 },
  // Public "apply for newsroom access" form, per network.
  application: { max: 3, windowSeconds: 3600 },
  // Public tip line (/mag-ulat), per network.
  tip: { max: 3, windowSeconds: 3600 },
  // Page-view beacon, per network. Generous because Philippine mobile carriers put many readers behind
  // one carrier-grade NAT address; it only caps scripted floods of page_view_events.
  track: { max: 600, windowSeconds: 600 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Fixed-window limiter stored in Postgres so it holds across serverless instances.
 * Fails CLOSED for write paths: if the limiter itself errors, the request is refused.
 */
export async function checkRateLimit(name: RateLimitName, subjectHash: string): Promise<boolean> {
  const { max, windowSeconds } = RATE_LIMITS[name];
  const { data, error } = await createServiceClient().rpc("check_rate_limit", {
    p_key: `${name}:${subjectHash}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    logServerError("rate_limit_failed", error);
    return false;
  }
  return data === true;
}
