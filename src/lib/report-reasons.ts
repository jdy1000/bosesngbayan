export const REPORT_REASONS = ["spam", "harassment", "hate_speech", "misinformation", "violence", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam o patalastas",
  harassment: "Panliligalig o pambu-bully",
  hate_speech: "Mapoot na pananalita",
  misinformation: "Maling impormasyon",
  violence: "Karahasan o banta",
  privacy: "Personal na impormasyon ng iba",
  other: "Iba pa",
};
