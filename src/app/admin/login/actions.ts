"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { networkHash } from "@/lib/security/hash";
import { siteUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";

export interface LoginState {
  error?: string;
  message?: string;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Ilagay ang wastong email.")),
  password: z.string().min(1, "Ilagay ang password.").max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (!(await checkRateLimit("login", networkHash(await headers())))) {
    return { error: "Masyadong maraming pagsubok. Maghintay ng ilang minuto." };
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One generic message: never reveal whether the email exists.
  if (error) return { error: "Mali ang email o password." };
  redirect("/admin");
}

const resetSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Ilagay ang wastong email.")) });

export async function requestPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await checkRateLimit("login", networkHash(await headers())))) {
    return { error: "Masyadong maraming pagsubok. Maghintay ng ilang minuto." };
  }
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: siteUrl("/admin/auth/callback?next=/admin/auth/update-password"),
  });
  if (error) logServerError("password_reset_request_failed", error);
  // Same answer regardless of outcome, so account existence cannot be probed.
  return { message: "Kung may account ang email na ito, makatatanggap ka ng link para mag-reset ng password." };
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
