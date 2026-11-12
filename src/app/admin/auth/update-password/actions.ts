"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/lib/auth/password";
import { logServerError } from "@/lib/log";
import { isRecentLinkSession, LINK_EXPIRED_URL } from "@/app/admin/auth/update-password/recent-link";

export interface PasswordState {
  error?: string;
}

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your session expired. Open the link again." };

  // No current password is asked here, so only a session opened from an emailed link in the last 15 minutes
  // may use it. Any other signed-in session changes its password in My account, which asks for the current one.
  const { data: token } = await supabase.auth.getClaims();
  if (!isRecentLinkSession(token?.claims.amr)) redirect(LINK_EXPIRED_URL);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("password_update_failed", error);
    return { error: "The password was not updated. Try a longer password." };
  }
  // Audit first: the row is written as this user, and the sign-out below ends the session.
  await supabase.rpc("write_audit", { p_action: "password_reset_completed", p_entity_type: "auth_user", p_entity_id: data.user.id });

  // End every session, this one included, so the new password is what opens Studio from now on.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) {
    logServerError("password_update_signout_failed", signOutError);
    return { error: "Your password was saved, but your devices could not be signed out. Open My account, then Security, and choose Sign out everywhere." };
  }
  redirect("/admin/login?notice=password-reset");
}
