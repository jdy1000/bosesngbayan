import type { BadgeTone } from "@/components/studio/ui";

export const POLL_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "green" },
  closed: { label: "Closed", tone: "amber" },
  archived: { label: "Archived", tone: "neutral" },
};

export const RESULTS_VISIBILITY_LABELS = {
  always: "Always visible",
  after_vote: "After voting",
  after_close: "After the poll closes",
  hidden: "Hidden (staff only)",
} as const;

export const VOTING_POLICY_LABELS = {
  one_per_browser: "One vote per browser",
  one_per_browser_and_network: "One vote per browser and network",
} as const;
