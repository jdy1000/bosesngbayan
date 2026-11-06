import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSiteSettings } from "@/lib/cms/site";
import { logServerError } from "@/lib/log";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Hindi wastong email address.")),
  consent: z.literal(true, { error: "Kailangan ang iyong pahintulot para mag-subscribe." }),
  source: z.string().trim().max(40).regex(/^[a-z0-9_-]*$/).default("site"),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(request: Request) {
  const parsed = await readJson(request, bodySchema);
  if (parsed.response) return parsed.response;
  if (parsed.data.website) return jsonOk({ message: "Salamat sa pag-subscribe!" });

  const settings = await getSiteSettings();
  if (!settings.newsletter.enabled) return jsonError("Pansamantalang sarado ang subscription.", 503);

  if (!(await checkRateLimit("newsletter", networkHash(request.headers)))) {
    return jsonError("Masyadong maraming pagsubok. Subukan muli mamaya.", 429);
  }

  try {
    const { error } = await createServiceClient().rpc("subscribe_newsletter", {
      p_email: parsed.data.email,
      p_consent_text: settings.newsletter.consent_text,
      p_source: parsed.data.source,
    });
    if (error) throw error;
    // Same response for new, existing and suppressed addresses so membership cannot be probed.
    // No confirmation email is claimed: sending requires a configured provider (see docs/ARCHITECTURE.md).
    return jsonOk({ message: "Salamat! Naitala ang iyong subscription." });
  } catch (error) {
    logServerError("newsletter_subscribe_failed", error);
    return jsonError("Hindi naitala ang subscription. Subukang muli.", 500);
  }
}
