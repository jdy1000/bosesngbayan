"use server";

import { headers } from "next/headers";
import { applicationSchema } from "@/lib/studio/applications";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { networkHash } from "@/lib/security/hash";
import { logServerError } from "@/lib/log";

export interface ApplyState {
  error?: string;
  message?: string;
  /** Echoed back on error so React's post-action form reset does not wipe what the applicant typed. */
  values?: Record<string, string>;
}

const FIELDS = ["full_name", "email", "requested_role", "organization", "portfolio_url", "message"] as const;

// One answer for new, duplicate and existing-staff emails, so the form cannot be used to probe accounts.
// It only promises a review: no email is sent by this form.
const RECEIVED =
  "Thank you. Your application has been received and an administrator will review it. If it is approved, an invitation to set up your Studio account is sent to the email you entered.";

/** Stores a pending request only. Creates no auth account and grants no access (spec §4.10). */
export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "").slice(0, 2000)]));
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form.", values };
  const { isBot, ...d } = parsed.data;
  if (isBot) return { message: RECEIVED };

  const net = networkHash(await headers());
  if (!(await checkRateLimit("application", net))) {
    return { error: "Too many applications from this network. Please try again in an hour.", values };
  }

  const { error } = await createServiceClient().rpc("submit_publisher_application", {
    p_full_name: d.full_name,
    p_email: d.email,
    p_requested_role: d.requested_role,
    p_organization: d.organization ?? "",
    p_portfolio_url: d.portfolio_url ?? "",
    p_message: d.message,
    p_network_hash: net,
  });
  if (error) {
    logServerError("application_submit_failed", error);
    return { error: "Your application could not be saved. Please try again later.", values };
  }
  return { message: RECEIVED };
}
