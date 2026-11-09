import { z } from "zod";
import { manilaLocalToIso } from "@/lib/format";
import { checkbox, optionalText, requiredText } from "@/lib/studio/form";
import type { BadgeTone } from "@/components/studio/ui";

export const AD_PLACEMENTS = ["home", "article"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = { home: "Homepage", article: "Article page" };

export type AdStatus = "live" | "scheduled" | "expired" | "inactive";
export const AD_STATUS: Record<AdStatus, { label: string; tone: BadgeTone }> = {
  live: { label: "Live", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  expired: { label: "Expired", tone: "amber" },
  inactive: { label: "Inactive", tone: "neutral" },
};

/** Mirrors the ad_slots_read RLS policy: live = active and inside the optional [starts_at, ends_at) window. */
export function adStatus(
  slot: { is_active: boolean; starts_at: string | null; ends_at: string | null },
  now: Date = new Date(),
): AdStatus {
  if (!slot.is_active) return "inactive";
  const t = now.getTime();
  if (slot.starts_at && new Date(slot.starts_at).getTime() > t) return "scheduled";
  if (slot.ends_at && new Date(slot.ends_at).getTime() <= t) return "expired";
  return "live";
}

const localDate = z.preprocess((v) => {
  if (typeof v !== "string" || v === "") return null;
  return manilaLocalToIso(v) ?? "invalid";
}, z.iso.datetime({ message: "Invalid date." }).nullable());

const httpsUrl = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : ""),
  z
    .string()
    .max(2048, "The destination URL is too long.")
    .regex(/^https:\/\/[^\s]+$/, "The destination must be an https:// URL.")
    .refine((v) => URL.canParse(v), { message: "The destination must be an https:// URL." }),
);

export const adSlotInputSchema = z
  .object({
    name: requiredText(1, 120, "Name"),
    placement: z.enum(AD_PLACEMENTS, { message: "Choose a placement." }),
    image_id: z.uuid({ message: "Choose an image." }),
    alt_text: optionalText(300),
    destination_url: httpsUrl,
    is_active: checkbox,
    starts_at: localDate,
    ends_at: localDate,
    sort_order: z.coerce.number().int("Order must be a whole number.").min(-1000).max(1000).default(0),
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at, {
    message: "The end time must be after the start time.",
    path: ["ends_at"],
  });

export type AdSlotInput = z.infer<typeof adSlotInputSchema>;
