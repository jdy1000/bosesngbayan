"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/session";
import { newPasswordSchema } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { networkHash } from "@/lib/security/hash";
import { adminUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";
import type { FormActionResult } from "@/components/studio/action-form";

const TOO_MANY = "Too many attempts. Wait a few minutes.";
const SIGNED_OUT = "Your session expired. Sign in again.";

const emailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")) });

/** Any signed-in staff member may change their own email. Supabase emails a confirmation link to BOTH addresses. */
export async function changeEmail(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: SIGNED_OUT };
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  if (parsed.data.email === ctx.email?.toLowerCase()) return { ok: false, error: "That is already your current email." };
  if (!(await checkRateLimit("login", networkHash(await headers())))) return { ok: false, error: TOO_MANY };

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

const passwordSchema = newPasswordSchema.and(z.object({ current: z.string().min(1, "Enter your current password.").max(200) }));

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

  // Re-verify the current password; this also refreshes the session, which secure_password_change requires.
  const verify = await ctx.supabase.auth.signInWithPassword({ email: ctx.email, password: parsed.data.current });
  if (verify.error) return { ok: false, error: "Your current password is incorrect." };

  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("password_change_failed", error);
    return { ok: false, error: "The password was not updated. Try again." };
  }
  await ctx.supabase.rpc("write_audit", { p_action: "account_password_changed", p_entity_type: "auth_user", p_entity_id: ctx.userId });
  return { ok: true, message: "Your password was updated." };
}
