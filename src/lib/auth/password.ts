import { z } from "zod";

/** Mirrors the Supabase Auth policy in supabase/config.toml (min 12, lower_upper_letters_digits). */
export const PASSWORD_RULES = "At least 12 characters, with upper- and lowercase letters and a number.";

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(200)
      .regex(/[a-z]/, "Add a lowercase letter.")
      .regex(/[A-Z]/, "Add an uppercase letter.")
      .regex(/[0-9]/, "Add a number."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords do not match.", path: ["confirm"] });
