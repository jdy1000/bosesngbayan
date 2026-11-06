"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;
const cookieOptions = () => ({ path: "/", maxAge: ONE_YEAR, sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" });

/** Reader preferences are plain cookies (no account needed). The page re-renders after each action. */
export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (isLocale(locale)) (await cookies()).set(LOCALE_COOKIE, locale, cookieOptions());
}

export async function setTheme(formData: FormData): Promise<void> {
  const theme = formData.get("theme");
  if (isTheme(theme)) (await cookies()).set(THEME_COOKIE, theme, cookieOptions());
}
