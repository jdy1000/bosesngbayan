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

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Gumamit ng hex color, hal. #1d4ed8");
const optionalHttps = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), { message: "https:// URL lamang." })
  .default("");

export const generalSettingsSchema = z.object({
  site_name: z.string().trim().min(1).max(80).default("Boses ng Bayan"),
  tagline: z.string().trim().max(160).default(""),
  description: z.string().trim().max(320).default(""),
  logo_media_id: z.uuid().nullable().default(null),
  favicon_media_id: z.uuid().nullable().default(null),
  brand: z
    .object({ primary: hexColor.default("#1d4ed8"), navy: hexColor.default("#0b1f5c"), accent: hexColor.default("#d62828") })
    .default({ primary: "#1d4ed8", navy: "#0b1f5c", accent: "#d62828" }),
  timezone: z.literal("Asia/Manila").default("Asia/Manila"),
  language: z.enum(["fil", "en"]).default("fil"),
  default_author_id: z.uuid().nullable().default(null),
  copyright_text: z.string().trim().max(200).default("© {year} Boses ng Bayan. Lahat ng karapatan ay nakalaan."),
  header_cta: z
    .object({ label: z.string().trim().min(1).max(40), href: z.string().trim().max(300).regex(/^(\/(?!\/)|https:\/\/)/) })
    .nullable()
    .default({ label: "Sumali sa Botohan", href: "/botohan" }),
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
    .refine((v) => v.includes("%s"), { message: "Dapat may %s ang template." })
    .default("%s | Boses ng Bayan"),
  default_title: z.string().trim().max(120).default("Boses ng Bayan"),
  default_description: z.string().trim().max(320).default(""),
  default_og_image_id: z.uuid().nullable().default(null),
  x_handle: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || /^@?[A-Za-z0-9_]{1,15}$/.test(v), { message: "Hindi wastong X handle." })
    .default(""),
  allow_indexing: z.boolean().default(true),
});

export const footerSettingsSchema = z.object({
  newsletter_title: z.string().trim().max(80).default("Manatiling updated!"),
  newsletter_description: z.string().trim().max(200).default(""),
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
});

export const newsletterSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  consent_text: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .default("Pumapayag akong makatanggap ng newsletter ng Boses ng Bayan sa email na ito. Maaari akong mag-unsubscribe anumang oras."),
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
