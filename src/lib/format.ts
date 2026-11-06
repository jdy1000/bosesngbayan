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

const dateFmt = new Intl.DateTimeFormat("fil-PH", {
  timeZone: SITE_TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("fil-PH", {
  timeZone: SITE_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return `${dateTimeFmt.format(new Date(value))} PHT`;
}

/** "2 oras na ang nakalipas" style relative time in Filipino. */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return "ngayon lang";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minuto na ang nakalipas`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} oras na ang nakalipas`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} araw na ang nakalipas`;
  return formatDate(value);
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
