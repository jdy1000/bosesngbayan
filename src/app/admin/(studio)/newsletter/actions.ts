"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { must } from "@/lib/studio/db";
import { optionalText } from "@/lib/studio/form";
import type { FormActionResult } from "@/components/studio/action-form";

const schema = z.object({
  id: z.uuid(),
  status: z.enum(["subscribed", "unsubscribed", "suppressed"]),
  reason: optionalText(500),
});

const MESSAGES = {
  subscribed: "Suppression lifted; the subscription is active again.",
  unsubscribed: "Email unsubscribed.",
  suppressed: "Email suppressed; it will no longer receive mail.",
} as const;

export async function setSubscriberStatus(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("newsletter.manage", "newsletter.view");
    const input = schema.parse(Object.fromEntries(fd));
    const current = must(
      await ctx.supabase.from("newsletter_subscribers").select("status, subscribed_at, unsubscribed_at").eq("id", input.id).single(),
    );
    if (current.status === input.status) return { ok: false, error: "The subscriber already has this status." };
    if (input.status === "subscribed") {
      // Consent rule: staff may only lift a suppression for someone who had not unsubscribed.
      // Anyone who unsubscribed must re-subscribe through the public form, which records fresh consent.
      const unsubscribedAfterSubscribing =
        current.unsubscribed_at !== null && new Date(current.unsubscribed_at) >= new Date(current.subscribed_at);
      if (current.status !== "suppressed" || unsubscribedAfterSubscribing) {
        return { ok: false, error: "Someone who unsubscribed must re-subscribe on the site themselves so fresh consent is recorded." };
      }
    }
    if (input.status === "suppressed" && !input.reason) return { ok: false, error: "Enter a reason for the suppression." };
    // set_subscriber_status re-checks newsletter.manage and writes the audit log.
    unwrap(await ctx.supabase.rpc("set_subscriber_status", { p_id: input.id, p_status: input.status, p_reason: input.reason }));
    revalidatePath("/admin/newsletter");
    return { ok: true, message: MESSAGES[input.status] };
  } catch (e) {
    return toActionError(e);
  }
}
