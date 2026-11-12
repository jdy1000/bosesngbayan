"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { networkHash } from "@/lib/security/hash";
import { adminUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";

export interface LoginState {
  error?: string;
  message?: string;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (!(await checkRateLimit("login", networkHash(await headers())))) {
    return { error: "Too many attempts. Wait a few minutes." };
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // One generic message: never reveal whether the email exists.
  if (error || !data.user) return { error: "Incorrect email or password." };

  // Same rule as getStaffContext(): an active profile with a role. Without it Studio would bounce the person
  // back here with a live session, so end the session and say why. Reached only after a correct password.
  const [profile, role] = await Promise.all([
    supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
  ]);
  const checkError = profile.error ?? role.error;
  if (checkError || !profile.data?.is_active || !role.data) {
    if (checkError) logServerError("login_access_check_failed", checkError);
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) logServerError("login_access_signout_failed", signOutError);
    return {
      error: checkError
        ? "We could not check your access. Try again."
        : "This account does not have newsroom access. Ask an administrator, or apply for access.",
    };
  }
  redirect("/dashboard");
}

const resetSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")) });

export async function requestPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await checkRateLimit("login", networkHash(await headers())))) {
    return { error: "Too many attempts. Wait a few minutes." };
  }
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: adminUrl("/admin/auth/callback?next=/admin/auth/update-password"),
  });
  if (error) logServerError("password_reset_request_failed", error);
  // Same answer regardless of outcome, so account existence cannot be probed.
  return { message: "If this email has an account, you will receive a link to reset your password." };
}

/** Ends the session on this device only. Other devices stay signed in; "Sign out everywhere" is in My account. */
export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}
