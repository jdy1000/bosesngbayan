import type { BadgeTone } from "@/components/studio/ui";

export const MODERATION_STATUSES = ["pending", "approved", "rejected", "hidden", "removed"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MODERATION_STATUS: Record<ModerationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  hidden: { label: "Hidden", tone: "neutral" },
  removed: { label: "Removed", tone: "red" },
};

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export const REPORT_STATUS: Record<(typeof REPORT_STATUSES)[number], { label: string; tone: BadgeTone }> = {
  open: { label: "Open", tone: "amber" },
  resolved: { label: "Resolved", tone: "green" },
  dismissed: { label: "Dismissed", tone: "neutral" },
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
  approve: "Approve",
  reject: "Reject",
  hide: "Hide",
  remove: "Remove",
  restore_pending: "Flag for re-review",
  feature: "Feature",
  unfeature: "Remove from featured",
};

/** Human labels for content_activity_logs.action values written by moderate_content/resolve_report. */
export function activityLabel(action: string): string {
  const [kind, value] = action.split(":");
  if (kind === "moderation" && value && value in ACTION_LABELS) return ACTION_LABELS[value as ModerationAction];
  if (kind === "report" && value && value in REPORT_STATUS) return `Report: ${REPORT_STATUS[value as keyof typeof REPORT_STATUS].label}`;
  return action;
}
