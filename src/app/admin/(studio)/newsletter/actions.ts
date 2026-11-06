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
  subscribed: "Inalis ang suppression; aktibo muli ang subscription.",
  unsubscribed: "Na-unsubscribe ang email.",
  suppressed: "Na-suppress ang email; hindi na ito padadalhan.",
} as const;

export async function setSubscriberStatus(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("newsletter.manage", "newsletter.view");
    const input = schema.parse(Object.fromEntries(fd));
    const current = must(
      await ctx.supabase.from("newsletter_subscribers").select("status, subscribed_at, unsubscribed_at").eq("id", input.id).single(),
    );
    if (current.status === input.status) return { ok: false, error: "Ganito na ang status ng subscriber." };
    if (input.status === "subscribed") {
      // Consent rule: staff may only lift a suppression for someone who had not unsubscribed.
      // Anyone who unsubscribed must re-subscribe through the public form, which records fresh consent.
      const unsubscribedAfterSubscribing =
        current.unsubscribed_at !== null && new Date(current.unsubscribed_at) >= new Date(current.subscribed_at);
      if (current.status !== "suppressed" || unsubscribedAfterSubscribing) {
        return { ok: false, error: "Ang nag-unsubscribe ay kailangang mag-subscribe muli mismo sa site para maitala ang bagong pahintulot." };
      }
    }
    if (input.status === "suppressed" && !input.reason) return { ok: false, error: "Ilagay ang dahilan ng suppression." };
    // set_subscriber_status re-checks newsletter.manage and writes the audit log.
    unwrap(await ctx.supabase.rpc("set_subscriber_status", { p_id: input.id, p_status: input.status, p_reason: input.reason }));
    revalidatePath("/admin/newsletter");
    return { ok: true, message: MESSAGES[input.status] };
  } catch (e) {
    return toActionError(e);
  }
}
