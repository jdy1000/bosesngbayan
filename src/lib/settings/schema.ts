import { z } from "zod";

/** Typed site_settings values. Defaults keep the public site rendering when a key is missing. */

/** WCAG 2.x contrast ratio of white text on a #rrggbb background. */
export function contrastWithWhite(hex: string): number {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return 1.05 / (l + 0.05);
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour, e.g. #1d4ed8");
const optionalHttps = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), { message: "Use an https:// URL." })
  .default("");

export const generalSettingsSchema = z.object({
  site_name: z.string().trim().min(1).max(80).default("Boses ng Bayan"),
  tagline: z.string().trim().max(160).default(""),
  tagline_en: z.string().trim().max(160).default(""),
  description: z.string().trim().max(320).default(""),
  description_en: z.string().trim().max(320).default(""),
  logo_media_id: z.uuid().nullable().default(null),
  favicon_media_id: z.uuid().nullable().default(null),
  brand: z
    .object({ primary: hexColor.default("#1d4ed8"), navy: hexColor.default("#0b1f5c"), accent: hexColor.default("#d62828") })
    .default({ primary: "#1d4ed8", navy: "#0b1f5c", accent: "#d62828" }),
  timezone: z.literal("Asia/Manila").default("Asia/Manila"),
  language: z.enum(["fil", "en"]).default("fil"),
  default_author_id: z.uuid().nullable().default(null),
  copyright_text: z.string().trim().max(200).default("© {year} Boses ng Bayan. Lahat ng karapatan ay nakalaan."),
  copyright_text_en: z.string().trim().max(200).default("© {year} Boses ng Bayan. All rights reserved."),
  header_cta: z
    .object({
      label: z.string().trim().min(1).max(40),
      label_en: z.string().trim().max(40).default(""),
      href: z.string().trim().max(300).regex(/^(\/(?!\/)|https:\/\/)/),
    })
    .nullable()
    .default({ label: "Sumali sa Botohan", label_en: "Join the Poll", href: "/botohan" }),
});

export const socialSettingsSchema = z.object({
  facebook: optionalHttps,
  youtube: optionalHttps,
  tiktok: optionalHttps,
  x: optionalHttps,
  instagram: optionalHttps,
  hashtag: z.string().trim().max(60).default(""),
});

export const contactSettingsSchema = z.object({
  email: z.union([z.literal(""), z.email()]).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
});

export const seoSettingsSchema = z.object({
  title_template: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v.includes("%s"), { message: "The template must contain %s." })
    .default("%s | Boses ng Bayan"),
  default_title: z.string().trim().max(120).default("Boses ng Bayan"),
  default_description: z.string().trim().max(320).default(""),
  default_og_image_id: z.uuid().nullable().default(null),
  x_handle: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || /^@?[A-Za-z0-9_]{1,15}$/.test(v), { message: "Invalid X handle." })
    .default(""),
  allow_indexing: z.boolean().default(true),
});

export const footerSettingsSchema = z.object({
  newsletter_title: z.string().trim().max(80).default("Manatiling updated!"),
  newsletter_title_en: z.string().trim().max(80).default("Stay updated!"),
  newsletter_description: z.string().trim().max(200).default(""),
  newsletter_description_en: z.string().trim().max(200).default(""),
  show_category_links: z.boolean().default(true),
});

export const publicationSettingsSchema = z.object({
  articles_per_page: z.number().int().min(6).max(48).default(12),
  show_reading_time: z.boolean().default(true),
  comments_enabled: z.boolean().default(true),
});

export const communitySettingsSchema = z.object({
  moderation_enabled: z.boolean().default(true),
  submissions_enabled: z.boolean().default(true),
  guidelines: z.string().trim().max(2000).default(""),
  guidelines_en: z.string().trim().max(2000).default(""),
});

export const newsletterSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  consent_text: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .default("Pumapayag akong makatanggap ng newsletter ng Boses ng Bayan sa email na ito. Maaari akong mag-unsubscribe anumang oras."),
  consent_text_en: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || v.length >= 10, { message: "Use at least 10 characters, or leave empty." })
    .default("I agree to receive the Boses ng Bayan newsletter at this email. I can unsubscribe at any time."),
});

export const SETTINGS_SCHEMAS = {
  general: generalSettingsSchema,
  social: socialSettingsSchema,
  contact: contactSettingsSchema,
  seo: seoSettingsSchema,
  footer: footerSettingsSchema,
  publication: publicationSettingsSchema,
  community: communitySettingsSchema,
  newsletter: newsletterSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export const SETTINGS_KEYS = Object.keys(SETTINGS_SCHEMAS) as SettingsKey[];
export type SiteSettings = { [K in SettingsKey]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };

export function parseSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingsKey, unknown>;
  for (const key of SETTINGS_KEYS) {
    const parsed = SETTINGS_SCHEMAS[key].safeParse(byKey.get(key) ?? {});
    out[key] = parsed.success ? parsed.data : SETTINGS_SCHEMAS[key].parse({});
  }
  return out as SiteSettings;
}

/**
 * Settings as the reader sees them: in English mode every `*_en` value that is filled replaces its
 * Filipino counterpart (ADR-015). The newsletter API records the returned consent text, so the stored
 * consent always matches the wording shown.
 */
export function localizeSettings(settings: SiteSettings, locale: "fil" | "en"): SiteSettings {
  if (locale !== "en") return settings;
  const pick = (fil: string, en: string) => en || fil;
  const { general, footer, community, newsletter } = settings;
  return {
    ...settings,
    general: {
      ...general,
      tagline: pick(general.tagline, general.tagline_en),
      description: pick(general.description, general.description_en),
      copyright_text: pick(general.copyright_text, general.copyright_text_en),
      header_cta: general.header_cta && { ...general.header_cta, label: pick(general.header_cta.label, general.header_cta.label_en) },
    },
    footer: {
      ...footer,
      newsletter_title: pick(footer.newsletter_title, footer.newsletter_title_en),
      newsletter_description: pick(footer.newsletter_description, footer.newsletter_description_en),
    },
    community: { ...community, guidelines: pick(community.guidelines, community.guidelines_en) },
    newsletter: { ...newsletter, consent_text: pick(newsletter.consent_text, newsletter.consent_text_en) },
  };
}
