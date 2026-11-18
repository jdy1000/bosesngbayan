import { z } from "zod";
import { checkbox, optionalText, optionalUuid, requiredText } from "@/lib/studio/form";
import { PHOTO_DEFAULTS } from "@/lib/survey-photo";

/** Empty -> null, "87,3" / "87.3%" -> 87.3. Anything else that is not a number is reported, never stored as NaN. */
const percent = (label: string) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return null;
      const t = v.trim().replace(/%$/, "").replace(",", ".").trim();
      return t === "" ? null : Number(t);
    },
    z
      .number({ message: `${label}: enter a number from 0 to 100.` })
      .min(0, `${label}: enter a number from 0 to 100.`)
      .max(100, `${label}: enter a number from 0 to 100.`)
      .transform((n) => Math.round(n * 10) / 10)
      .nullable(),
  );

const isRealDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export const surveyInputSchema = z.object({
  title: requiredText(1, 160, "Title"),
  scope: optionalText(120),
  subtitle: optionalText(240),
  note: optionalText(500),
  survey_date: z.string().trim().refine(isRealDate, { message: "Choose the date the ratings were released." }),
  is_published: checkbox,
  show_on_homepage: checkbox,
  sort_order: z.coerce.number().int("Order must be a whole number.").min(-1000).max(1000).default(0),
});
export type SurveyInput = z.infer<typeof surveyInputSchema>;

/** A whole number within a range; a missing or blank field takes the default instead of 0. */
const wholeNumber = (label: string, min: number, max: number, fallback: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : undefined),
    z.number({ message: `${label}: enter a whole number from ${min} to ${max}.` }).int(`${label}: enter a whole number from ${min} to ${max}.`).min(min, `${label}: enter a whole number from ${min} to ${max}.`).max(max, `${label}: enter a whole number from ${min} to ${max}.`).default(fallback),
  );

export const surveyEntryInputSchema = z.object({
  name: requiredText(1, 120, "Name"),
  area: optionalText(120),
  rank_no: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : null),
    z.number({ message: "Rank: enter a whole number from 1 to 999." }).int("Rank: enter a whole number from 1 to 999.").min(1, "Rank: enter a whole number from 1 to 999.").max(999, "Rank: enter a whole number from 1 to 999.").nullable(),
  ),
  overall_pct: percent("Overall score"),
  trust_pct: percent("Trust"),
  performance_pct: percent("Performance"),
  photo_id: optionalUuid,
  photo_x: wholeNumber("Photo position (left–right)", 0, 100, PHOTO_DEFAULTS.x),
  photo_y: wholeNumber("Photo position (top–bottom)", 0, 100, PHOTO_DEFAULTS.y),
  photo_zoom: wholeNumber("Photo zoom", 100, 300, PHOTO_DEFAULTS.zoom),
});
export type SurveyEntryInput = z.infer<typeof surveyEntryInputSchema>;

export type SurveyState = "live" | "draft" | "hidden";
export const SURVEY_STATE: Record<SurveyState, { label: string; tone: "green" | "neutral" | "amber" }> = {
  live: { label: "On homepage", tone: "green" },
  hidden: { label: "Published, not on homepage", tone: "amber" },
  draft: { label: "Draft", tone: "neutral" },
};

/** Mirrors the public query: a survey is on the homepage only when it is published and switched on for it. */
export function surveyState(s: { is_published: boolean; show_on_homepage: boolean }): SurveyState {
  if (!s.is_published) return "draft";
  return s.show_on_homepage ? "live" : "hidden";
}
