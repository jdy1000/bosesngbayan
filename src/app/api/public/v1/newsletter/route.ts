import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSiteSettings } from "@/lib/cms/site";
import { logServerError } from "@/lib/log";
import { getLocale } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n/config";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";
import { localizeSettings } from "@/lib/settings/schema";

const bodySchema = (m: Messages["newsletter"]["api"]) => z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email(m.invalidEmail)),
  consent: z.literal(true, { error: m.consentRequired }),
  source: z.string().trim().max(40).regex(/^[a-z0-9_-]*$/).default("site"),
  locale: z.enum(LOCALES).optional(), // language the form was shown in
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(request: Request) {
  const locale = await getLocale();
  const m = MESSAGES[locale].newsletter;
  const parsed = await readJson(request, bodySchema(m.api));
  if (parsed.response) return parsed.response;
  if (parsed.data.website) return jsonOk({ message: m.api.thanks });

  // Record the consent wording in the language the reader saw.
  const settings = localizeSettings(await getSiteSettings(), parsed.data.locale ?? locale);
  if (!settings.newsletter.enabled) return jsonError(m.api.closed, 503);

  if (!(await checkRateLimit("newsletter", networkHash(request.headers)))) {
    return jsonError(m.api.rateLimited, 429);
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
    return jsonOk({ message: m.subscribed });
  } catch (error) {
    logServerError("newsletter_subscribe_failed", error);
    return jsonError(m.api.subscribeFailed, 500);
  }
}
