import type { Locale } from "@/lib/i18n/config";

export const REPORT_REASONS = ["spam", "harassment", "hate_speech", "misinformation", "violence", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Public site uses the reader's locale; Studio (English-only) uses `.en`. */
export const REPORT_REASON_LABELS: Record<Locale, Record<ReportReason, string>> = {
  fil: {
    spam: "Spam o patalastas",
    harassment: "Panliligalig o pambu-bully",
    hate_speech: "Mapoot na pananalita",
    misinformation: "Maling impormasyon",
    violence: "Karahasan o banta",
    privacy: "Personal na impormasyon ng iba",
    other: "Iba pa",
  },
  en: {
    spam: "Spam or advertising",
    harassment: "Harassment or bullying",
    hate_speech: "Hate speech",
    misinformation: "Misinformation",
    violence: "Violence or threats",
    privacy: "Someone else's personal information",
    other: "Other",
  },
};
