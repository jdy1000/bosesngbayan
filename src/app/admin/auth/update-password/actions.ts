"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/lib/auth/password";
import { logServerError } from "@/lib/log";

export interface PasswordState {
  error?: string;
}

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Nag-expire ang session. Buksan muli ang link." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("password_update_failed", error);
    return { error: "Hindi na-update ang password. Subukan ang mas mahabang password." };
  }
  await supabase.rpc("write_audit", { p_action: "password_reset_completed", p_entity_type: "auth_user", p_entity_id: data.user.id });
  redirect("/admin");
}
