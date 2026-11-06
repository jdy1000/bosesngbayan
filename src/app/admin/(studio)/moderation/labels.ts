import type { BadgeTone } from "@/components/studio/ui";

export const MODERATION_STATUSES = ["pending", "approved", "rejected", "hidden", "removed"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MODERATION_STATUS: Record<ModerationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Naghihintay", tone: "amber" },
  approved: { label: "Aprubado", tone: "green" },
  rejected: { label: "Ni-reject", tone: "red" },
  hidden: { label: "Nakatago", tone: "neutral" },
  removed: { label: "Tinanggal", tone: "red" },
};

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export const REPORT_STATUS: Record<(typeof REPORT_STATUSES)[number], { label: string; tone: BadgeTone }> = {
  open: { label: "Bukas", tone: "amber" },
  resolved: { label: "Naresolba", tone: "green" },
  dismissed: { label: "Ibinasura", tone: "neutral" },
};

/** moderate_content() actions. "restore_pending" is the Studio "flag for re-review" action. */
export const MODERATION_ACTIONS = ["approve", "reject", "hide", "remove", "restore_pending", "feature", "unfeature"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const ACTION_TARGET: Partial<Record<ModerationAction, ModerationStatus>> = {
  approve: "approved",
  reject: "rejected",
  hide: "hidden",
  remove: "removed",
  restore_pending: "pending",
};

export const ACTION_LABELS: Record<ModerationAction, string> = {
  approve: "Aprubahan",
  reject: "I-reject",
  hide: "Itago",
  remove: "Tanggalin",
  restore_pending: "I-flag para suriin muli",
  feature: "I-feature",
  unfeature: "Alisin sa featured",
};

/** Human labels for content_activity_logs.action values written by moderate_content/resolve_report. */
export function activityLabel(action: string): string {
  const [kind, value] = action.split(":");
  if (kind === "moderation" && value && value in ACTION_LABELS) return ACTION_LABELS[value as ModerationAction];
  if (kind === "report" && value && value in REPORT_STATUS) return `Ulat: ${REPORT_STATUS[value as keyof typeof REPORT_STATUS].label}`;
  return action;
}
