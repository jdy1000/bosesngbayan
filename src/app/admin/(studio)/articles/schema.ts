import { z } from "zod";
import { isValidSlug } from "@/lib/format";

/** Shared by the article and page editors (server validation of FormData). */
export const optText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: ${max} characters maximum.`)
    .transform((v) => (v === "" ? null : v));

export const optUuid = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.uuid("Invalid selection.").nullable());

export const canonicalUrl = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => {
    if (v === null) return true;
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "The canonical URL must be a full https:// link.");

export const slugField = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Enter a slug.")
    .max(max, `Slug: ${max} characters maximum.`)
    .refine(isValidSlug, "Slugs may only use lowercase letters, numbers and hyphens (e.g. new-story).");

const jsonArray = <T extends z.ZodType>(item: T, max: number) =>
  z
    .string()
    .default("[]")
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid data." });
        return z.NEVER;
      }
    })
    .pipe(z.array(item).max(max, `${max} maximum.`));

export const articleFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(300, "Title: 300 characters maximum."),
  subtitle: optText(400, "Subtitle"),
  slug: slugField(160),
  excerpt: optText(600, "Excerpt"),
  body: z.string().max(2_000_000, "Content is too long."),
  category_id: optUuid,
  location_id: optUuid,
  author_id: optUuid.optional(),
  featured_image_id: optUuid,
  og_image_id: optUuid,
  seo_title: optText(120, "SEO title"),
  seo_description: optText(320, "SEO description"),
  canonical_url: canonicalUrl,
  source_attribution: optText(1000, "Source"),
  correction_note: optText(1000, "Correction"),
  tag_ids: jsonArray(z.uuid(), 30).transform((a) => [...new Set(a)]),
  related_ids: jsonArray(z.uuid(), 12).transform((a) => [...new Set(a)]),
  contributors: jsonArray(
    z.object({
      profile_id: z.uuid(),
      role_label: z.string().trim().min(1, "Enter the contributor's role.").max(60, "Role: 60 characters maximum."),
    }),
    20,
  ).refine((a) => new Set(a.map((c) => c.profile_id)).size === a.length, "Duplicate contributor."),
});

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: string; conflict?: boolean; field?: string };
