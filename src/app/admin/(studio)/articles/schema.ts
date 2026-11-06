import { z } from "zod";
import { isValidSlug } from "@/lib/format";

/** Shared by the article and page editors (server validation of FormData). */
export const optText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: hanggang ${max} karakter lamang.`)
    .transform((v) => (v === "" ? null : v));

export const optUuid = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.uuid("Hindi wastong pagpili.").nullable());

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
  }, "Ang canonical URL ay dapat buong https:// na link.");

export const slugField = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Ilagay ang slug.")
    .max(max, `Ang slug ay hanggang ${max} karakter lamang.`)
    .refine(isValidSlug, "Ang slug ay maliliit na titik, numero at gitling lamang (hal. bagong-balita).");

const jsonArray = <T extends z.ZodType>(item: T, max: number) =>
  z
    .string()
    .default("[]")
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Hindi wastong data." });
        return z.NEVER;
      }
    })
    .pipe(z.array(item).max(max, `Hanggang ${max} lamang.`));

export const articleFormSchema = z.object({
  title: z.string().trim().min(1, "Ilagay ang pamagat.").max(300, "Pamagat: hanggang 300 karakter lamang."),
  subtitle: optText(400, "Subtitle"),
  slug: slugField(160),
  excerpt: optText(600, "Excerpt"),
  body: z.string().max(2_000_000, "Masyadong mahaba ang nilalaman."),
  category_id: optUuid,
  location_id: optUuid,
  author_id: optUuid.optional(),
  featured_image_id: optUuid,
  og_image_id: optUuid,
  seo_title: optText(120, "SEO title"),
  seo_description: optText(320, "SEO description"),
  canonical_url: canonicalUrl,
  source_attribution: optText(1000, "Pinagkunan"),
  correction_note: optText(1000, "Pagwawasto"),
  tag_ids: jsonArray(z.uuid(), 30).transform((a) => [...new Set(a)]),
  related_ids: jsonArray(z.uuid(), 12).transform((a) => [...new Set(a)]),
  contributors: jsonArray(
    z.object({
      profile_id: z.uuid(),
      role_label: z.string().trim().min(1, "Ilagay ang papel ng kontribyutor.").max(60, "Papel: hanggang 60 karakter."),
    }),
    20,
  ).refine((a) => new Set(a.map((c) => c.profile_id)).size === a.length, "May dobleng kontribyutor."),
});

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: string; conflict?: boolean; field?: string };
