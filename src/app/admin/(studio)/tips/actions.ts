"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { optionalText } from "@/lib/studio/form";
import { TIP_STATUSES } from "@/lib/tips";
import type { FormActionResult } from "@/components/studio/action-form";

const input = z.object({
  id: z.uuid(),
  status: z.enum(["reviewing", "verified", "dismissed"], { message: "Choose a status." }),
  note: optionalText(2000, "Staff note: up to 2000 characters."),
  // The version the form was built from; review_tip() refuses the change if the tip was saved since.
  updated_at: z.string().min(1).max(64),
  // The tab to return to; only known values are used to build the address.
  tab: z.enum([...TIP_STATUSES, "all"]).catch("new"),
});

/**
 * Sets a tip's status and staff note. review_tip() re-checks tips.manage, requires a note to dismiss, and audits.
 * A tip whose status changes leaves its tab and its form unmounts, so the outcome is shown by the page after a
 * server redirect, as on Applications: ?done=1, or ?changed=1 when someone else saved the tip since this form
 * was built (its row may already have left the tab, taking the form's error message with it). redirect() throws,
 * so it runs outside the try/catch.
 */
export async function reviewTip(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  const tab = input.shape.tab.parse(fd.get("tab"));
  let outcome: "done" | "changed" = "done";
  try {
    const ctx = await requirePermission("tips.manage");
    const d = input.parse(Object.fromEntries(fd));
    unwrap(await ctx.supabase.rpc("review_tip", { p_id: d.id, p_status: d.status, p_note: d.note, p_expected_updated_at: d.updated_at }));
  } catch (e) {
    if ((e as { message?: unknown } | null)?.message !== "tip_changed") return toActionError(e);
    outcome = "changed";
  }
  revalidatePath("/admin/tips");
  redirect(`/admin/tips?tab=${tab}&${outcome}=1`);
}
