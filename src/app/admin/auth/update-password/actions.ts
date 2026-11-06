"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";

export interface PasswordState {
  error?: string;
}

const schema = z
  .object({
    password: z
      .string()
      .min(12, "Hindi bababa sa 12 karakter.")
      .max(200)
      // Mirrors the Supabase Auth policy (supabase/config.toml: lower_upper_letters_digits).
      .regex(/[a-z]/, "Kailangan ng maliit na titik.")
      .regex(/[A-Z]/, "Kailangan ng malaking titik.")
      .regex(/[0-9]/, "Kailangan ng numero."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Hindi magkatugma ang mga password.", path: ["confirm"] });

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = schema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Nag-expire ang session. Buksan muli ang link." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("password_update_failed", error);
    return { error: "Hindi na-update ang password. Subukan ang mas mahabang password." };
  }
  redirect("/admin");
}
