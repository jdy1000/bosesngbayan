import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/log";
import { getMessages } from "@/lib/i18n/server";

const bodySchema = z.object({ token: z.uuid() });

export async function POST(request: Request) {
  const parsed = await readJson(request, bodySchema);
  if (parsed.response) return parsed.response;
  const m = (await getMessages()).newsletter.api;
  if (!(await checkRateLimit("newsletter", networkHash(request.headers)))) {
    return jsonError(m.rateLimited, 429);
  }
  try {
    const { error } = await createServiceClient().rpc("unsubscribe_newsletter", { p_token: parsed.data.token });
    if (error) throw error;
    // Uniform answer whether or not the token matched, so tokens cannot be probed.
    return jsonOk({ message: m.unsubscribed });
  } catch (error) {
    logServerError("newsletter_unsubscribe_failed", error);
    return jsonError(m.unsubscribeFailed, 500);
  }
}
