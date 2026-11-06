import { z } from "zod";
import type { Locale } from "@/lib/i18n/config";

/**
 * Typed homepage block schema. homepage_sections.settings is JSON in the database; this module is
 * the single contract for what each block type may contain. Studio validates on save; the public
 * renderer validates on read and skips (never crashes on) malformed sections.
 */

export const BLOCK_TYPES = [
  "hero",
  "top_stories",
  "trending_topics",
  "breaking_news",
  "featured_story",
  "latest_articles",
  "article_grid",
  "category_showcase",
  "editors_picks",
  "most_read",
  "poll_showcase",
  "community",
  "regional_news",
  "newsletter",
  "custom_cta",
  "photo_of_day",
  "quote_of_day",
  "news_quiz",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero (poll)",
  top_stories: "Top stories",
  trending_topics: "Trending topics",
  breaking_news: "Breaking news",
  featured_story: "Featured story",
  latest_articles: "Latest articles",
  article_grid: "Article grid",
  category_showcase: "Category showcase",
  editors_picks: "Editor's picks",
  most_read: "Most read",
  poll_showcase: "Poll showcase",
  community: "Community (Usap Bayan)",
  regional_news: "Regional news",
  newsletter: "Newsletter",
  custom_cta: "Custom CTA",
  photo_of_day: "Photo of the Day",
  quote_of_day: "Quote of the Day",
  news_quiz: "News quiz",
};

/** Same-site path or https URL. Blocks open redirects / javascript: links at the schema level. */
export const safeHref = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(?!\/)/.test(v) || v === "/" || /^https:\/\/[^\s]+$/.test(v), {
    message: "Use a path starting with / or an https:// URL.",
  });

const uuid = z.uuid();
const optionalUuid = uuid.nullable().default(null);
// label_en is the optional English label shown when a reader switches the site to English (ADR-015).
const linkSchema = z.object({ label: z.string().trim().min(1).max(60), label_en: z.string().trim().max(60).default(""), href: safeHref });
const optionalLink = linkSchema.nullable().default(null);
const limit = (max: number, def: number) => z.number().int().min(1).max(max).default(def);

export const ARTICLE_SOURCES = ["latest", "featured", "editors_picks", "breaking", "category", "manual", "most_read"] as const;

const heroSettings = z.object({
  eyebrow: z.string().trim().max(60).default(""),
  headline: z.string().trim().min(1).max(160),
  highlight: z.string().trim().max(60).default(""),
  description: z.string().trim().max(400).default(""),
  primary_cta: optionalLink,
  secondary_cta: optionalLink,
  image_id: optionalUuid,
  poll_id: optionalUuid,
  show_participation_count: z.boolean().default(false),
  participation_label: z.string().trim().max(120).default(""),
});

const trendingSettings = z.object({ view_all: optionalLink });

const articleListSettings = z.object({
  source: z.enum(ARTICLE_SOURCES).default("latest"),
  category_id: optionalUuid,
  article_ids: z.array(uuid).max(24).default([]),
  limit: limit(24, 3),
  view_all: optionalLink,
  /** latest_articles only: numbered most-read sidebar (hidden when there is no page-view data). */
  with_sidebar: z.boolean().default(false),
});

const topStoriesSettings = z.object({
  lead_source: z.enum(["featured", "latest", "manual"]).default("featured"),
  lead_article_id: optionalUuid,
  rail_count: z.number().int().min(0).max(6).default(4),
  below_count: z.number().int().min(0).max(6).default(3),
});

const featuredStorySettings = z.object({
  source: z.enum(["featured", "manual", "latest"]).default("featured"),
  article_id: optionalUuid,
});

const breakingSettings = z.object({ limit: limit(10, 5) });

const categoryShowcaseSettings = z.object({
  category_ids: z.array(uuid).max(8).default([]),
  per_category: limit(6, 3),
});

const mostReadSettings = z.object({
  days: z.number().int().min(1).max(90).default(7),
  limit: limit(10, 5),
});

const pollShowcaseSettings = z.object({
  poll_id: optionalUuid,
  show_active_list: z.boolean().default(true),
  limit: limit(6, 3),
});

const communitySettings = z.object({
  limit: limit(12, 3),
  featured_only: z.boolean().default(false),
  cta: optionalLink,
});

const regionalSettings = z.object({
  location_ids: z.array(uuid).max(6).default([]),
  per_location: limit(6, 3),
});

const newsletterSettings = z.object({ source: z.string().trim().max(40).default("homepage") });

export const CTA_ICONS = ["chart", "messages", "users", "megaphone", "vote", "newspaper", "heart", "shield"] as const;

const customCtaSettings = z.object({
  variant: z.enum(["feature_tiles", "banner", "simple"]).default("simple"),
  cta: optionalLink,
  image_id: optionalUuid,
  items: z
    .array(z.object({ icon: z.enum(CTA_ICONS), label: z.string().trim().min(1).max(80) }))
    .max(6)
    .default([]),
});

const photoOfDaySettings = z.object({
  media_id: optionalUuid,
  caption: z.string().trim().max(400).default(""),
  link: optionalLink,
});

const quoteOfDaySettings = z.object({
  quote: z.string().trim().min(1).max(500),
  attribution: z.string().trim().min(1).max(160),
  context: z.string().trim().max(240).default(""),
  source_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//.test(v), { message: "Use an https:// URL." })
    .default(""),
});

const quizSettings = z.object({
  intro: z.string().trim().max(300).default(""),
  questions: z
    .array(
      z
        .object({
          question: z.string().trim().min(1).max(300),
          options: z.array(z.string().trim().min(1).max(160)).min(2).max(5),
          correct_index: z.number().int().min(0).max(4),
          explanation: z.string().trim().max(500).default(""),
          article_slug: z.string().trim().max(160).default(""),
        })
        .refine((q) => q.correct_index < q.options.length, { message: "The correct answer must be one of the options." }),
    )
    .min(1)
    .max(10),
});

export const BLOCK_SETTINGS_SCHEMAS = {
  hero: heroSettings,
  top_stories: topStoriesSettings,
  trending_topics: trendingSettings,
  breaking_news: breakingSettings,
  featured_story: featuredStorySettings,
  latest_articles: articleListSettings,
  article_grid: articleListSettings,
  category_showcase: categoryShowcaseSettings,
  editors_picks: articleListSettings,
  most_read: mostReadSettings,
  poll_showcase: pollShowcaseSettings,
  community: communitySettings,
  regional_news: regionalSettings,
  newsletter: newsletterSettings,
  custom_cta: customCtaSettings,
  photo_of_day: photoOfDaySettings,
  quote_of_day: quoteOfDaySettings,
  news_quiz: quizSettings,
} as const satisfies Record<BlockType, z.ZodType>;

export type BlockSettings<T extends BlockType> = z.infer<(typeof BLOCK_SETTINGS_SCHEMAS)[T]>;

export type HomepageBlock = {
  [K in BlockType]: {
    id: string;
    type: K;
    title: string | null;
    description: string | null;
    settings: BlockSettings<K>;
  };
}[BlockType];

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

export interface RawSection {
  id: string;
  block_type: string;
  title: string | null;
  description: string | null;
  /** Optional English labels shown when the reader chose English (empty → Filipino). */
  title_en?: string | null;
  description_en?: string | null;
  settings: unknown;
}

/** Parse a stored section. Returns null (and the issues) for unknown or invalid configuration. */
/** Swaps every link's label for its filled-in English label (links can sit at any depth of a block's settings). */
function englishLinkLabels<T>(value: T): T {
  if (Array.isArray(value)) return value.map(englishLinkLabels) as T;
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = englishLinkLabels(v);
  if (typeof out.label === "string" && typeof out.label_en === "string" && out.label_en) out.label = out.label_en;
  return out as T;
}

export function parseSection(raw: RawSection, locale: Locale = "fil"): { block: HomepageBlock | null; issues: string[] } {
  if (!isBlockType(raw.block_type)) return { block: null, issues: [`Unknown block type ${raw.block_type}`] };
  const schema = BLOCK_SETTINGS_SCHEMAS[raw.block_type];
  const parsed = schema.safeParse(raw.settings ?? {});
  if (!parsed.success) {
    return { block: null, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  return {
    block: {
      id: raw.id,
      type: raw.block_type,
      title: locale === "en" && raw.title_en ? raw.title_en : raw.title,
      description: locale === "en" && raw.description_en ? raw.description_en : raw.description,
      settings: locale === "en" ? englishLinkLabels(parsed.data) : parsed.data,
    } as HomepageBlock,
    issues: [],
  };
}

/** Default settings for a newly added block in the builder. */
export function defaultSettings(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "hero":
      return heroSettings.parse({ headline: "Bagong headline" });
    case "quote_of_day":
      return { quote: "", attribution: "", context: "", source_url: "" };
    case "news_quiz":
      return { intro: "", questions: [] };
    default:
      return BLOCK_SETTINGS_SCHEMAS[type].parse({}) as Record<string, unknown>;
  }
}
