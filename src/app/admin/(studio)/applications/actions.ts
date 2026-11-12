"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { applicationRoleSchema } from "@/lib/studio/applications";
import { optionalText, requiredText } from "@/lib/studio/form";
import { inviteStaff } from "@/lib/studio/invite";
import type { FormActionResult } from "@/components/studio/action-form";

const id = z.uuid();
type Outcome = { ok: false; error: string } | { ok: true; done: "invited" | "staff" | "rejected" };

// A reviewed row loses its decision form, so the outcome is shown by the page (?done=) after a
// server redirect. redirect() throws, so it must run outside the try/catch below.
function finish(outcome: Outcome): FormActionResult {
  if (!outcome.ok) return outcome;
  revalidatePath("/admin/applications");
  revalidatePath("/admin/team");
  redirect(`/admin/applications?done=${outcome.done}`);
}

/**
 * The decision form of a pending application: one form, and the pressed button names the decision.
 * Each path checks users.manage and validates its own input before anything is sent or stored.
 */
export async function reviewApplication(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  const decision = fd.get("decision");
  if (decision === "approved") return finish(await approve(fd));
  if (decision === "rejected") return finish(await reject(fd));
  return { ok: false, error: "Choose Reject or Approve & invite." };
}

/** Approve & invite: reuses the team invitation flow, then records the decision and the optional note (audited in the RPC). */
async function approve(fd: FormData): Promise<Outcome> {
  try {
    const ctx = await requirePermission("users.manage");
    const input = z
      .object({ id, role: applicationRoleSchema, note: optionalText(1000, "Review note: up to 1000 characters.") })
      .parse(Object.fromEntries(fd));
    const app = unwrap(await ctx.supabase.from("publisher_applications").select("full_name, email, status").eq("id", input.id).maybeSingle());
    if (!app) return toActionError({ message: "application_not_found" });
    if (app.status !== "pending") return toActionError({ message: "application_already_reviewed" });

    const email = app.email.toLowerCase();
    const staff = (unwrap(await ctx.supabase.rpc("staff_directory")) ?? []).find((s) => s.email?.toLowerCase() === email);
    let invitedUserId = staff?.user_id ?? null;
    if (!staff) {
      const invite = await inviteStaff(ctx, { email, displayName: app.full_name, role: input.role });
      if (!invite.ok) {
        return {
          ok: false,
          error: invite.emailExists
            ? "This email already has a sign-in account without a staff role, so no invitation was sent. Assign a role from the Team page or delete that account in Supabase Auth first."
            : invite.error,
        };
      }
      invitedUserId = invite.userId;
    }

    const { error } = await ctx.supabase.rpc("review_publisher_application", {
      p_id: input.id,
      p_decision: "approved",
      p_note: input.note,
      p_role: staff ? null : input.role, // null = no role granted (already staff)
      p_invited_user_id: invitedUserId,
    });
    if (error) {
      const reason = toActionError(error).error;
      return { ok: false, error: staff ? reason : `The invitation was sent, but the application could not be marked approved: ${reason}` };
    }
    return { ok: true, done: staff ? "staff" : "invited" };
  } catch (e) {
    return toActionError(e);
  }
}

async function reject(fd: FormData): Promise<Outcome> {
  try {
    const ctx = await requirePermission("users.manage");
    const input = z.object({ id, note: requiredText(3, 1000, "Rejection reason") }).parse(Object.fromEntries(fd));
    unwrap(await ctx.supabase.rpc("review_publisher_application", { p_id: input.id, p_decision: "rejected", p_note: input.note }));
    return { ok: true, done: "rejected" };
  } catch (e) {
    return toActionError(e);
  }
}
