import { fmt, intlLocale, LOCALES, type Locale } from "@/lib/i18n/config";

export const SITE_TIMEZONE = "Asia/Manila";

/** URL-safe slug. Strips Filipino/Spanish diacritics (ñ → n). */
export function slugify(input: string, maxLength = 120): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

type FormatLocale = Locale;

// Formatters are built once per locale (Intl construction is not free).
const formatters = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    {
      date: new Intl.DateTimeFormat(intlLocale(l), { timeZone: SITE_TIMEZONE, year: "numeric", month: "long", day: "numeric" }),
      dateTime: new Intl.DateTimeFormat(intlLocale(l), {
        timeZone: SITE_TIMEZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      dateline: new Intl.DateTimeFormat(intlLocale(l), { timeZone: SITE_TIMEZONE, weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    },
  ]),
) as Record<FormatLocale, { date: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat; dateline: Intl.DateTimeFormat }>;

// Studio is English-only, so English is the default; public pages pass the reader's locale.

/** "Friday, November 6, 2026" / "Biyernes, Nobyembre 6, 2026" in Manila time, for mastheads. */
export function formatDateline(value: Date = new Date(), locale: FormatLocale = "en"): string {
  const s = formatters[locale].dateline.format(value);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDate(value: string | Date | null | undefined, locale: FormatLocale = "en"): string {
  if (!value) return "";
  return formatters[locale].date.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined, locale: FormatLocale = "en"): string {
  if (!value) return "";
  return `${formatters[locale].dateTime.format(new Date(value))} PHT`;
}

const AGO = {
  fil: { now: "ngayon lang", min: "{n} minuto na ang nakalipas", hour: "{n} oras na ang nakalipas", day: "{n} araw na ang nakalipas" },
  en: { now: "just now", min: "{n} min ago", hour: "{n} hr ago", day: "{n} days ago" },
} as const;

/** Relative time ("2 oras na ang nakalipas" / "2 hr ago"); older than a week falls back to the date. */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date(), locale: FormatLocale = "en"): string {
  if (!value) return "";
  const words = AGO[locale];
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return words.now;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return fmt(words.min, { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fmt(words.hour, { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 && locale === "en" ? "1 day ago" : fmt(words.day, { n: days });
  return formatDate(value, locale);
}

const numberFmt = new Intl.NumberFormat("en-PH");
export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Convert a Manila-local "YYYY-MM-DDTHH:mm" (from datetime-local inputs) into a UTC ISO string. */
export function manilaLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  // Asia/Manila has no DST: fixed UTC+08:00.
  const d = new Date(`${local}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Inverse of manilaLocalToIso for prefilling datetime-local inputs. */
export function isoToManilaLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
