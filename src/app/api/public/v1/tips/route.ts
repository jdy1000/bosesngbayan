import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { clientIp, hmac } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/log";
import { getMessages } from "@/lib/i18n/server";
import { tipSchema } from "@/lib/tips";

/**
 * Tip line (ADR-024). The tip is stored privately for tips.manage holders and never published.
 * The rate-limit key has its own hash scope, so the short-lived bucket cannot be joined to the network hashes
 * stored with comments, community posts or applications. Nothing about the sender's network is stored with the tip.
 */
export async function POST(request: Request) {
  const m = (await getMessages()).tips.api;
  const parsed = await readJson(request, tipSchema(m));
  if (parsed.response) return parsed.response;
  if (parsed.data.hp) return jsonOk({ message: m.received }, { status: 201 });

  // shortcut: per-network limit and honeypot only; a spam flood from many networks would bury real tips. Add a
  // self-hosted proof-of-work challenge if the queue is ever flooded (security review M3, ADR-024).
  if (!(await checkRateLimit("tip", hmac("network:tip", clientIp(request.headers))))) {
    return jsonError(m.rateLimited, 429);
  }

  try {
    const d = parsed.data;
    const { error } = await createServiceClient().rpc("submit_tip", {
      p_subject: d.subject,
      p_details: d.details,
      p_agency: d.agency,
      p_location: d.location,
      p_evidence_urls: d.evidence,
      p_contact_name: d.contactName,
      p_contact: d.contact,
    });
    if (error) throw error;
    return jsonOk({ message: m.received }, { status: 201 });
  } catch (error) {
    logServerError("tip_submit_failed", error);
    return jsonError(m.failed, 500);
  }
}
