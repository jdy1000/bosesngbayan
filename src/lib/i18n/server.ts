import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSiteSettings } from "@/lib/cms/site";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";

/** The reader's choice (cookie) or the site default from Site Settings. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  // The root layout calls this; a settings outage must not take down every page, so fall back to Filipino.
  return getSiteSettings().then(
    (s) => s.general.language,
    () => "fil" as const,
  );
});

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}

/** Locale and messages together, for server components. */
export async function getI18n(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await getLocale();
  return { locale, t: MESSAGES[locale] };
}
