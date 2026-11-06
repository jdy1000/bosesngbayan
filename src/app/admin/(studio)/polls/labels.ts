import type { BadgeTone } from "@/components/studio/ui";

export const POLL_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Nakalathala", tone: "green" },
  closed: { label: "Sarado", tone: "amber" },
  archived: { label: "Naka-archive", tone: "neutral" },
};

export const RESULTS_VISIBILITY_LABELS = {
  always: "Palaging nakikita",
  after_vote: "Pagkatapos bumoto",
  after_close: "Pagkasara ng botohan",
  hidden: "Nakatago (staff lamang)",
} as const;

export const VOTING_POLICY_LABELS = {
  one_per_browser: "Isang boto bawat browser",
  one_per_browser_and_network: "Isang boto bawat browser at network",
} as const;
