/** Public-site languages. Filipino is the default (Site Settings → language); Studio is English-only. */
export const LOCALES = ["fil", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "bnb_lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Intl locale tag for dates and numbers. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-PH" : "fil-PH";
}

/** Fill `{name}` placeholders. Messages stay plain strings so they can cross to client components. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** Pick an optional English CMS label when the reader chose English. */
export function localized(locale: Locale, fil: string, en: string | null | undefined): string {
  return locale === "en" && en ? en : fil;
}
