"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffContext, type StaffContext } from "@/lib/auth/session";
import { newPasswordSchema } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { networkHash } from "@/lib/security/hash";
import { adminUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";
import { optionalText, requiredText } from "@/lib/studio/form";
import type { FormActionResult } from "@/components/studio/action-form";

const TOO_MANY = "Too many attempts. Wait a few minutes.";
const SIGNED_OUT = "Your session expired. Sign in again.";

const currentPassword = z.string().min(1, "Enter your current password.").max(200);

/**
 * Re-verifies the current password with Supabase Auth, so an unattended open session cannot change the
 * sign-in details. It also starts a fresh session on this device, which secure_password_change requires.
 */
async function verifyCurrentPassword(ctx: StaffContext, email: string, password: string): Promise<boolean> {
  const { error } = await ctx.supabase.auth.signInWithPassword({ email, password });
  return !error;
}

// Tighter than the columns allow (120 / 120 / 2000): these three fields can appear with a public byline.
const profileSchema = z.object({
  display_name: requiredText(2, 80, "Display name"),
  title: optionalText(100, "Job title: up to 100 characters."),
  bio: optionalText(500, "Biography: up to 500 characters."),
});

/** A staff member edits their own profile row. RLS (profiles_self_update) limits the update to that row. */
export async function saveProfile(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: SIGNED_OUT };
  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name"),
    title: formData.get("title"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { data, error } = await ctx.supabase.from("profiles").update(parsed.data).eq("id", ctx.userId).select("id");
  if (error || !data || data.length === 0) {
    if (error) logServerError("profile_update_failed", error);
    return { ok: false, error: "Your profile could not be saved. Try again." };
  }
  await ctx.supabase.rpc("write_audit", {
    p_action: "update_profile",
    p_entity_type: "profiles",
    p_entity_id: ctx.userId,
    p_details: { fields: Object.keys(parsed.data) },
  });
  // The Studio layout shows the display name in the top bar.
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Your profile has been updated." };
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  current: currentPassword,
});

/**
 * Any signed-in staff member may change their own email, after proving the current password.
 * Supabase emails a confirmation link to BOTH addresses.
 */
export async function changeEmail(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.email) return { ok: false, error: SIGNED_OUT };
  const parsed = emailSchema.safeParse({ email: formData.get("email"), current: formData.get("current") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  if (parsed.data.email === ctx.email.toLowerCase()) return { ok: false, error: "That is already your current email." };
  if (!(await checkRateLimit("login", networkHash(await headers())))) return { ok: false, error: TOO_MANY };

  if (!(await verifyCurrentPassword(ctx, ctx.email, parsed.data.current))) {
    return { ok: false, error: "Your current password could not be verified." };
  }

  const { error } = await ctx.supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: adminUrl("/admin/auth/callback?next=/admin/account") },
  );
  if (error) {
    logServerError("email_change_request_failed", error);
    // Same wording whether or not the address is taken, so other accounts cannot be probed.
    return { ok: false, error: "Could not send the confirmation. Try again later or use a different email." };
  }
  await ctx.supabase.rpc("write_audit", {
    p_action: "account_email_change_requested",
    p_entity_type: "auth_user",
    p_entity_id: ctx.userId,
  });
  return {
    ok: true,
    message: "We sent a link to your old and new email. Your email changes once both are confirmed.",
  };
}

const passwordSchema = newPasswordSchema.and(z.object({ current: currentPassword }));

/** Requires the current password, so an unattended open session cannot be used to take over the account. */
export async function changePassword(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.email) return { ok: false, error: SIGNED_OUT };
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  if (parsed.data.current === parsed.data.password) return { ok: false, error: "Choose a password different from your current one." };
  if (!(await checkRateLimit("login", networkHash(await headers())))) return { ok: false, error: TOO_MANY };

  if (!(await verifyCurrentPassword(ctx, ctx.email, parsed.data.current))) {
    return { ok: false, error: "Your current password is incorrect." };
  }

  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("password_change_failed", error);
    return { ok: false, error: "The password was not updated. Try again." };
  }
  await ctx.supabase.rpc("write_audit", { p_action: "account_password_changed", p_entity_type: "auth_user", p_entity_id: ctx.userId });

  // Other devices may still hold the old password's sessions. End them; this one (re-verified above) stays.
  const { error: signOutError } = await ctx.supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    logServerError("password_change_signout_others_failed", signOutError);
    return { ok: true, message: "Your password was updated, but other devices could not be signed out. Use Sign out everywhere." };
  }
  return { ok: true, message: "Your password was updated. Other devices have been signed out." };
}

/** Ends every session of the signed-in person, this device included, and returns them to the sign-in screen. */
export async function signOutEverywhere(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: SIGNED_OUT };
  if (formData.get("confirm") !== "on") return { ok: false, error: "Confirm that you will need to sign in again." };

  // Audit first: the row is written as this user, and the sign-out below ends the session.
  await ctx.supabase.rpc("write_audit", { p_action: "account_signed_out_everywhere", p_entity_type: "auth_user", p_entity_id: ctx.userId });
  const { error } = await ctx.supabase.auth.signOut({ scope: "global" });
  if (error) {
    logServerError("sign_out_everywhere_failed", error);
    return { ok: false, error: "Your sessions could not be signed out. Try again." };
  }
  redirect("/admin/login?notice=signed-out");
}
