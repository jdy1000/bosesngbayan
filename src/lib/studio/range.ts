/**
 * Studio date-range filter. All days are Asia/Manila calendar days (fixed UTC+08:00, no DST).
 * The resulting range is half-open [from, to) as expected by analytics_summary().
 */

export const RANGE_PRESETS = ["today", "7d", "30d", "90d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Ngayong araw",
  "7d": "Huling 7 araw",
  "30d": "Huling 30 araw",
  "90d": "Huling 90 araw",
  custom: "Custom na saklaw",
};

/** analytics_summary() rejects ranges longer than 400 days. */
export const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;
const MANILA_OFFSET_MS = 8 * 3_600_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  preset: RangePreset;
  label: string;
  /** Inclusive first Manila day, YYYY-MM-DD. */
  fromDate: string;
  /** Inclusive last Manila day, YYYY-MM-DD. */
  toDate: string;
  fromIso: string;
  toIso: string;
  /** Every Manila day in the range, for zero-filled charts. */
  days: string[];
  /** Set when custom input was invalid and the default was used instead. */
  error?: string;
}

export function manilaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

function dayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00+08:00`);
}

function addDays(day: string, n: number): string {
  return new Date(dayStartMs(day) + MANILA_OFFSET_MS + n * DAY_MS).toISOString().slice(0, 10);
}

function isRealDate(day: string): boolean {
  return DATE_RE.test(day) && !Number.isNaN(dayStartMs(day)) && addDays(day, 0) === day;
}

function build(preset: RangePreset, fromDate: string, toDate: string, error?: string): DateRange {
  const days: string[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) days.push(d);
  const label = preset === "custom" ? `${fromDate} hanggang ${toDate}` : RANGE_LABELS[preset];
  return {
    preset,
    label,
    fromDate,
    toDate,
    fromIso: new Date(dayStartMs(fromDate)).toISOString(),
    toIso: new Date(dayStartMs(toDate) + DAY_MS).toISOString(),
    days,
    ...(error ? { error } : {}),
  };
}

/** Parse ?range=&from=&to= search params. Never throws; invalid custom input falls back to 7 days. */
export function parseRange(
  params: { range?: string | string[]; from?: string | string[]; to?: string | string[] },
  defaultPreset: Exclude<RangePreset, "custom"> = "7d",
  now: Date = new Date(),
): DateRange {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const raw = one(params.range);
  const preset: RangePreset = (RANGE_PRESETS as readonly string[]).includes(raw) ? (raw as RangePreset) : defaultPreset;
  const today = manilaToday(now);
  const fallback = (error: string) => build(defaultPreset, addDays(today, defaultPreset === "today" ? 0 : -(parseInt(defaultPreset, 10) - 1)), today, error);

  if (preset === "today") return build("today", today, today);
  if (preset !== "custom") return build(preset, addDays(today, -(parseInt(preset, 10) - 1)), today);

  const from = one(params.from);
  const to = one(params.to);
  if (!isRealDate(from) || !isRealDate(to)) return fallback("Pumili ng wastong petsa ng simula at katapusan.");
  if (from > to) return fallback("Ang petsa ng simula ay dapat bago o kapareho ng katapusan.");
  if (to > today) return fallback("Hindi maaaring lumampas sa araw na ito ang katapusan.");
  if ((dayStartMs(to) - dayStartMs(from)) / DAY_MS + 1 > MAX_RANGE_DAYS) return fallback(`Hanggang ${MAX_RANGE_DAYS} araw lamang ang saklaw.`);
  return build("custom", from, to);
}

/** Zero-fill a per-day series onto the range's days. Missing days had no recorded events. */
export function fillDays<K extends string>(days: string[], rows: ({ day: string } & Record<K, number>)[], keys: K[]): ({ day: string } & Record<K, number>)[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r]));
  return days.map((day) => {
    const row = byDay.get(day);
    const out = { day } as { day: string } & Record<K, number>;
    for (const k of keys) (out as Record<K, number>)[k] = Number(row?.[k] ?? 0);
    return out;
  });
}
