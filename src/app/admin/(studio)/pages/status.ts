import type { Database } from "@/lib/database.types";

/** Page status labels; plain module so both server pages and the client editor can import it. */
export type PageStatus = Database["public"]["Enums"]["page_status"];
export const PAGE_STATUSES: PageStatus[] = ["draft", "published", "archived"];
export const PAGE_STATUS_LABELS: Record<PageStatus, { label: string; tone: "neutral" | "green" }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Nakalathala", tone: "green" },
  archived: { label: "Naka-archive", tone: "neutral" },
};
