import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security/request";
import { isLikelyBot, networkHash, visitorHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/log";

const bodySchema = z.object({
  // Studio and the tip line (/mag-ulat, ADR-024) are never recorded.
  path: z.string().max(500).regex(/^\/(?!admin|mag-ulat)[^\s]*$/),
  articleId: z.uuid().nullable().default(null),
  referrer: z.string().max(1000).default(""),
});

function referrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host === ownHost ? null : host.slice(0, 255);
  } catch {
    return null;
  }
}

/**
 * Page-view beacon. Always answers 204 so tracking never affects readers. Respects Do-Not-Track
 * and Global Privacy Control; filters obvious bots; caps each network (RATE_LIMITS.track); dedupes in the
 * database (30-minute window).
 */
export async function POST(request: Request) {
  const noContent = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (!isSameOrigin(request)) return noContent;
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return noContent;
  if (isLikelyBot(request.headers.get("user-agent"))) return noContent;

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return noContent;
    body = JSON.parse(text);
  } catch {
    return noContent;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return noContent;
  // Over the limit, the view is dropped silently (still 204): tracking never affects readers.
  if (!(await checkRateLimit("track", networkHash(request.headers)))) return noContent;

  try {
    const { error } = await createServiceClient().rpc("record_page_view", {
      p_path: parsed.data.path.split("?")[0]!,
      p_article_id: parsed.data.articleId ?? null,
      p_visitor_hash: visitorHash(request.headers),
      p_referrer_host: referrerHost(parsed.data.referrer, new URL(request.url).hostname) ?? null,
    });
    if (error) throw error;
  } catch (error) {
    logServerError("track_failed", error);
  }
  return noContent;
}
