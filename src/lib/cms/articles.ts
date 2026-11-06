import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Public article queries. They use the anonymous client, so RLS already hides non-public rows;
 * the explicit status/published_at filters mirror public.article_is_public() and let Postgres use
 * articles_public_idx.
 */

const MEDIA = "id, storage_path, external_url, alt_text, caption, credit, width, height";

export const ARTICLE_CARD_SELECT = `id, slug, title, excerpt, published_at, content_updated_at, reading_minutes,
  is_featured, is_breaking, is_editors_pick,
  category:categories!articles_category_id_fkey(id, slug, name),
  author:profiles!articles_author_id_fkey(id, display_name, slug),
  image:media_assets!articles_featured_image_id_fkey(${MEDIA})`;

export interface MediaSummary {
  id: string;
  storage_path: string | null;
  external_url: string | null;
  alt_text: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
}

export interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  content_updated_at: string | null;
  reading_minutes: number;
  is_featured: boolean;
  is_breaking: boolean;
  is_editors_pick: boolean;
  category: { id: string; slug: string; name: string } | null;
  author: { id: string; display_name: string; slug: string | null } | null;
  image: MediaSummary | null;
}

export interface ArticleListOptions {
  page?: number;
  pageSize?: number;
  categoryId?: string | null;
  locationIds?: string[];
  tagId?: string | null;
  ids?: string[];
  excludeIds?: string[];
  featured?: boolean;
  editorsPick?: boolean;
  breaking?: boolean;
  /** false skips the exact row count (one fewer scan) for callers that only read `items`; `total` is then the page length. */
  withTotal?: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listPublicArticles(opts: ArticleListOptions = {}): Promise<Paginated<ArticleCard>> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, Math.floor(opts.pageSize ?? 12)));
  const supabase = createPublicClient();

  let articleIdsForTag: string[] | null = null;
  if (opts.tagId) {
    const { data, error } = await supabase.from("article_tags").select("article_id").eq("tag_id", opts.tagId);
    if (error) throw error;
    articleIdsForTag = (data ?? []).map((r) => r.article_id);
    if (articleIdsForTag.length === 0) return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  let query = supabase
    .from("articles")
    .select(ARTICLE_CARD_SELECT, opts.withTotal === false ? undefined : { count: "exact" })
    .in("status", ["published", "scheduled"])
    .lte("published_at", nowIso())
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });

  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.locationIds && opts.locationIds.length > 0) query = query.in("location_id", opts.locationIds);
  if (articleIdsForTag) query = query.in("id", articleIdsForTag);
  if (opts.ids && opts.ids.length > 0) query = query.in("id", opts.ids);
  if (opts.excludeIds && opts.excludeIds.length > 0) query = query.not("id", "in", `(${opts.excludeIds.join(",")})`);
  if (opts.featured) query = query.eq("is_featured", true);
  if (opts.editorsPick) query = query.eq("is_editors_pick", true);
  if (opts.breaking) query = query.eq("is_breaking", true);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count ?? data?.length ?? 0;
  return {
    items: (data ?? []) as unknown as ArticleCard[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Keep the caller's ordering for manually curated lists. */
export async function getPublicArticlesByIds(ids: string[]): Promise<ArticleCard[]> {
  if (ids.length === 0) return [];
  const { items } = await listPublicArticles({ ids, pageSize: Math.min(ids.length, 48), withTotal: false });
  const byId = new Map(items.map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)).filter((a): a is ArticleCard => Boolean(a));
}

export async function getMostReadArticles(days: number, limit: number, categoryId: string | null = null): Promise<ArticleCard[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_most_read_article_ids", {
    p_days: days,
    p_limit: limit,
    p_category_id: categoryId ?? undefined,
  });
  if (error) throw error;
  return getPublicArticlesByIds(((data ?? []) as { article_id: string }[]).map((r) => r.article_id));
}

export interface ArticleDetail extends ArticleCard {
  subtitle: string | null;
  body_html: string;
  first_published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  source_attribution: string | null;
  correction_note: string | null;
  allow_comments: boolean;
  location: { id: string; slug: string; name: string } | null;
  og_image: MediaSummary | null;
  author: { id: string; display_name: string; slug: string | null; title: string | null; bio: string | null; avatar_url: string | null } | null;
  tags: { id: string; slug: string; name: string }[];
  contributors: { role_label: string; profile: { id: string; display_name: string } | null }[];
  related_ids: string[];
}

export const getPublicArticleBySlug = cache(async (slug: string): Promise<ArticleDetail | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      `id, slug, title, subtitle, excerpt, body_html, published_at, first_published_at, content_updated_at, reading_minutes,
       is_featured, is_breaking, is_editors_pick, seo_title, seo_description, canonical_url, source_attribution,
       correction_note, allow_comments,
       category:categories!articles_category_id_fkey(id, slug, name),
       location:locations!articles_location_id_fkey(id, slug, name),
       author:profiles!articles_author_id_fkey(id, display_name, slug, title, bio, avatar_url),
       image:media_assets!articles_featured_image_id_fkey(${MEDIA}),
       og_image:media_assets!articles_og_image_id_fkey(${MEDIA}),
       article_tags(tag:tags(id, slug, name)),
       article_contributors(role_label, position, profile:profiles(id, display_name)),
       related_articles!related_articles_article_id_fkey(related_article_id, position)`,
    )
    .eq("slug", slug)
    .in("status", ["published", "scheduled"])
    .lte("published_at", nowIso())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Omit<ArticleDetail, "tags" | "contributors" | "related_ids"> & {
    article_tags: { tag: { id: string; slug: string; name: string } | null }[];
    article_contributors: { role_label: string; position: number; profile: { id: string; display_name: string } | null }[];
    related_articles: { related_article_id: string; position: number }[];
  };
  const { article_tags, article_contributors, related_articles, ...rest } = row;
  return {
    ...rest,
    tags: article_tags.map((t) => t.tag).filter((t): t is NonNullable<typeof t> => Boolean(t)),
    contributors: [...article_contributors].sort((a, b) => a.position - b.position),
    related_ids: [...related_articles].sort((a, b) => a.position - b.position).map((r) => r.related_article_id),
  };
});

/** Editor-chosen related stories, topped up with same-category recency. */
export async function getRelatedArticles(article: ArticleDetail, limit = 3): Promise<ArticleCard[]> {
  const chosen = await getPublicArticlesByIds(article.related_ids.slice(0, limit));
  if (chosen.length >= limit || !article.category) return chosen.slice(0, limit);
  const { items } = await listPublicArticles({
    categoryId: article.category.id,
    excludeIds: [article.id, ...chosen.map((c) => c.id)],
    pageSize: limit - chosen.length,
    withTotal: false,
  });
  return [...chosen, ...items];
}

/** Full-text search over public articles (Postgres websearch syntax, `simple` dictionary). */
export async function searchPublicArticles(q: string, page = 1, pageSize = 12): Promise<Paginated<ArticleCard>> {
  const term = q.trim().slice(0, 120);
  if (term.length < 2) return { items: [], total: 0, page: 1, pageSize, totalPages: 0 };
  const supabase = createPublicClient();
  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("articles")
    .select(ARTICLE_CARD_SELECT, { count: "exact" })
    .in("status", ["published", "scheduled"])
    .lte("published_at", nowIso())
    .textSearch("search_vector", term, { type: "websearch", config: "simple" })
    .order("published_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count ?? 0;
  return { items: (data ?? []) as unknown as ArticleCard[], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
