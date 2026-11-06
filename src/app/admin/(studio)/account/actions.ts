"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/session";
import { newPasswordSchema } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { networkHash } from "@/lib/security/hash";
import { siteUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";
import type { FormActionResult } from "@/components/studio/action-form";

const TOO_MANY = "Masyadong maraming pagsubok. Maghintay ng ilang minuto.";
const SIGNED_OUT = "Nag-expire ang session. Mag-login muli.";

const emailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Ilagay ang wastong email.")) });

/** Any signed-in staff member may change their own email. Supabase emails a confirmation link to BOTH addresses. */
export async function changeEmail(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: SIGNED_OUT };
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ilagay ang wastong email." };
  if (parsed.data.email === ctx.email?.toLowerCase()) return { ok: false, error: "Ito na ang kasalukuyang email mo." };
  if (!(await checkRateLimit("login", networkHash(await headers())))) return { ok: false, error: TOO_MANY };

  const { error } = await ctx.supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: siteUrl("/admin/auth/callback?next=/admin/account") },
  );
  if (error) {
    logServerError("email_change_request_failed", error);
    // Same wording whether or not the address is taken, so other accounts cannot be probed.
    return { ok: false, error: "Hindi maipadala ang kumpirmasyon. Subukan muli mamaya o gumamit ng ibang email." };
  }
  await ctx.supabase.rpc("write_audit", {
    p_action: "account_email_change_requested",
    p_entity_type: "auth_user",
    p_entity_id: ctx.userId,
  });
  return {
    ok: true,
    message: "Nagpadala kami ng link sa luma at sa bagong email. Magbabago ang email kapag nakumpirma ang dalawa.",
  };
}

const passwordSchema = newPasswordSchema.and(z.object({ current: z.string().min(1, "Ilagay ang kasalukuyang password.").max(200) }));

/** Requires the current password, so an unattended open session cannot be used to take over the account. */
export async function changePassword(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.email) return { ok: false, error: SIGNED_OUT };
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Suriin ang mga field." };
  if (parsed.data.current === parsed.data.password) return { ok: false, error: "Pumili ng password na iba sa kasalukuyan." };
  if (!(await checkRateLimit("login", networkHash(await headers())))) return { ok: false, error: TOO_MANY };

  // Re-verify the current password; this also refreshes the session, which secure_password_change requires.
  const verify = await ctx.supabase.auth.signInWithPassword({ email: ctx.email, password: parsed.data.current });
  if (verify.error) return { ok: false, error: "Mali ang kasalukuyang password." };

  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("password_change_failed", error);
    return { ok: false, error: "Hindi na-update ang password. Subukan muli." };
  }
  await ctx.supabase.rpc("write_audit", { p_action: "account_password_changed", p_entity_type: "auth_user", p_entity_id: ctx.userId });
  return { ok: true, message: "Na-update ang password mo." };
}
