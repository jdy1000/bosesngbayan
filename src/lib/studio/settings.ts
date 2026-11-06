import "server-only";
import { z } from "zod";
import type { StaffContext } from "@/lib/auth/session";
import { unwrap } from "@/lib/actions";
import { mediaUrl } from "@/lib/media";
import { contrastWithWhite, parseSettings, SETTINGS_SCHEMAS, type SettingsKey, type SiteSettings } from "@/lib/settings/schema";
import type { Json } from "@/lib/database.types";
import { must } from "@/lib/studio/db";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const idOrNull = (fd: FormData, k: string) => str(fd, k) || null;
const num = (fd: FormData, k: string) => (str(fd, k) === "" ? undefined : Number(str(fd, k)));

/** FormData → raw settings object per key. Validation happens in SETTINGS_SCHEMAS, not here. */
const FORM_MAPPERS: { [K in SettingsKey]: (fd: FormData) => Record<string, unknown> } = {
  general: (fd) => {
    const ctaLabel = str(fd, "header_cta_label");
    const ctaLabelEn = str(fd, "header_cta_label_en");
    const ctaHref = str(fd, "header_cta_href");
    return {
      site_name: str(fd, "site_name"),
      tagline: str(fd, "tagline"),
      tagline_en: str(fd, "tagline_en"),
      description: str(fd, "description"),
      description_en: str(fd, "description_en"),
      logo_media_id: idOrNull(fd, "logo_media_id"),
      favicon_media_id: idOrNull(fd, "favicon_media_id"),
      brand: { primary: str(fd, "brand_primary"), navy: str(fd, "brand_navy"), accent: str(fd, "brand_accent") },
      timezone: "Asia/Manila",
      language: str(fd, "language"),
      default_author_id: idOrNull(fd, "default_author_id"),
      copyright_text: str(fd, "copyright_text"),
      copyright_text_en: str(fd, "copyright_text_en"),
      header_cta: ctaLabel || ctaHref ? { label: ctaLabel, label_en: ctaLabelEn, href: ctaHref } : null,
    };
  },
  social: (fd) => ({
    facebook: str(fd, "facebook"),
    youtube: str(fd, "youtube"),
    tiktok: str(fd, "tiktok"),
    x: str(fd, "x"),
    instagram: str(fd, "instagram"),
    hashtag: str(fd, "hashtag"),
  }),
  contact: (fd) => ({ email: str(fd, "email"), phone: str(fd, "phone"), address: str(fd, "address") }),
  seo: (fd) => ({
    title_template: str(fd, "title_template"),
    default_title: str(fd, "default_title"),
    default_description: str(fd, "default_description"),
    default_og_image_id: idOrNull(fd, "default_og_image_id"),
    x_handle: str(fd, "x_handle"),
    allow_indexing: bool(fd, "allow_indexing"),
  }),
  footer: (fd) => ({
    newsletter_title: str(fd, "newsletter_title"),
    newsletter_description: str(fd, "newsletter_description"),
    newsletter_title_en: str(fd, "newsletter_title_en"),
    newsletter_description_en: str(fd, "newsletter_description_en"),
    show_category_links: bool(fd, "show_category_links"),
  }),
  publication: (fd) => ({
    articles_per_page: num(fd, "articles_per_page"),
    show_reading_time: bool(fd, "show_reading_time"),
    comments_enabled: bool(fd, "comments_enabled"),
  }),
  community: (fd) => ({
    moderation_enabled: bool(fd, "moderation_enabled"),
    submissions_enabled: bool(fd, "submissions_enabled"),
    guidelines: str(fd, "guidelines"),
    guidelines_en: str(fd, "guidelines_en"),
  }),
  newsletter: (fd) => ({ enabled: bool(fd, "enabled"), consent_text: str(fd, "consent_text"), consent_text_en: str(fd, "consent_text_en") }),
};

export class SettingsValidationError extends Error {}

/** Validate with the key's schema and upsert as the signed-in user (RLS: settings.manage). Audited by trigger. */
export async function saveSettingsFromForm(ctx: StaffContext, key: SettingsKey, fd: FormData): Promise<void> {
  const parsed = SETTINGS_SCHEMAS[key].safeParse(FORM_MAPPERS[key](fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SettingsValidationError(`${issue?.path.join(".") || key}: ${issue?.message ?? "Invalid value."}`);
  }
  if (key === "general") {
    // White text sits on all three brand colours (buttons, footer, breaking label): enforce WCAG AA.
    const brand = (parsed.data as SiteSettings["general"]).brand;
    for (const [name, hex] of Object.entries(brand)) {
      if (contrastWithWhite(hex) < 4.5) {
        throw new SettingsValidationError(`brand.${name}: ${hex} is too light — it needs ≥ 4.5:1 contrast against white text.`);
      }
    }
  }
  unwrap(
    await ctx.supabase
      .from("site_settings")
      .upsert({ key, value: parsed.data as Json, updated_by: ctx.userId }, { onConflict: "key" }),
  );
}

export async function loadSettings(ctx: StaffContext): Promise<{ settings: SiteSettings; updatedAt: Partial<Record<SettingsKey, string>> }> {
  const rows = must(await ctx.supabase.from("site_settings").select("key, value, updated_at"));
  return {
    settings: parseSettings(rows),
    updatedAt: Object.fromEntries(rows.map((r) => [r.key, r.updated_at])) as Partial<Record<SettingsKey, string>>,
  };
}

export async function loadPickedMedia(ctx: StaffContext, ids: (string | null)[]) {
  const wanted = ids.filter((v): v is string => Boolean(v));
  if (wanted.length === 0) return new Map<string, { id: string; url: string | null; alt_text: string | null }>();
  const rows = must(await ctx.supabase.from("media_assets").select("id, storage_path, external_url, alt_text").in("id", wanted));
  return new Map(rows.map((m) => [m.id, { id: m.id, url: mediaUrl(m), alt_text: m.alt_text }]));
}

export const editableSettingsKey = z.enum(["general", "social", "contact", "footer", "publication", "community", "newsletter"]);
