import { z } from "zod";

/** Mirrors the Supabase Auth policy in supabase/config.toml (min 12, lower_upper_letters_digits). */
export const PASSWORD_RULES = "Hindi bababa sa 12 karakter, may malaki at maliit na titik at numero.";

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Hindi bababa sa 12 karakter.")
      .max(200)
      .regex(/[a-z]/, "Kailangan ng maliit na titik.")
      .regex(/[A-Z]/, "Kailangan ng malaking titik.")
      .regex(/[0-9]/, "Kailangan ng numero."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Hindi magkatugma ang mga password.", path: ["confirm"] });
