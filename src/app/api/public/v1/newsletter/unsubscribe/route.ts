import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/log";

const bodySchema = z.object({ token: z.uuid() });

export async function POST(request: Request) {
  const parsed = await readJson(request, bodySchema);
  if (parsed.response) return parsed.response;
  if (!(await checkRateLimit("newsletter", networkHash(request.headers)))) {
    return jsonError("Masyadong maraming pagsubok. Subukan muli mamaya.", 429);
  }
  try {
    const { error } = await createServiceClient().rpc("unsubscribe_newsletter", { p_token: parsed.data.token });
    if (error) throw error;
    // Uniform answer whether or not the token matched, so tokens cannot be probed.
    return jsonOk({ message: "Na-unsubscribe ka na. Salamat sa pagsubaybay sa Boses ng Bayan." });
  } catch (error) {
    logServerError("newsletter_unsubscribe_failed", error);
    return jsonError("Hindi naproseso. Subukang muli.", 500);
  }
}
