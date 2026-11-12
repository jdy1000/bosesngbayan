import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { mediaUrl } from "@/lib/media";
import type { ArticleDetail, MediaSummary } from "@/lib/cms/articles";

/**
 * Studio (admin) article loaders. Everything goes through the caller's SESSION client, so RLS
 * decides which drafts are visible; nothing here uses the service role.
 */

export type ArticleStatus = Database["public"]["Enums"]["article_status"];
export const ARTICLE_STATUSES: ArticleStatus[] = ["draft", "pending_review", "approved", "published", "scheduled", "archived", "rejected"];

const MEDIA = "id, storage_path, external_url, alt_text, caption, credit, width, height";
const PAGE_SIZE = 12; // as in the Newsmaker console

export const ARTICLE_SORTS = {
  updated: { column: "updated_at", label: "Last modified" },
  published: { column: "published_at", label: "Publication date" },
  created: { column: "created_at", label: "Date created" },
  title: { column: "title", label: "Title (A–Z)" },
} as const;
export type ArticleSort = keyof typeof ARTICLE_SORTS;

export interface StudioArticleRow {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  is_featured: boolean;
  published_at: string | null;
  updated_at: string;
  category: { name: string } | null;
  author: { display_name: string } | null;
  image: MediaSummary | null;
}

export interface ArticleListFilters {
  status?: ArticleStatus;
  q?: string;
  categoryId?: string;
  authorId?: string;
  sort: ArticleSort;
  page: number;
}

/** Strip characters that would break a PostgREST `or=(…)` filter. */
export function safeLike(q: string): string {
  return `%${q.replace(/[%_,()*\\]/g, " ").trim()}%`;
}

export async function listStudioArticles(ctx: StaffContext, f: ArticleListFilters) {
  const sort = ARTICLE_SORTS[f.sort];
  let query = ctx.supabase
    .from("articles")
    .select(
      `id, slug, title, status, is_featured, published_at, updated_at,
       category:categories!articles_category_id_fkey(name),
       author:profiles!articles_author_id_fkey(display_name),
       image:media_assets!articles_featured_image_id_fkey(${MEDIA})`,
      { count: "exact" },
    )
    .order(sort.column, { ascending: f.sort === "title", nullsFirst: false })
    .order("id", { ascending: false });
  if (f.status) query = query.eq("status", f.status);
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.authorId) query = query.eq("author_id", f.authorId);
  if (f.q) {
    const like = safeLike(f.q);
    query = query.or(`title.ilike.${like},slug.ilike.${like}`);
  }
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as StudioArticleRow[];

  let views: Map<string, number> | null = null;
  if (ctx.permissions.has("analytics.view") && rows.length > 0) {
    const { data: v, error: vErr } = await ctx.supabase.rpc("get_article_view_counts", { p_article_ids: rows.map((r) => r.id) });
    if (vErr) throw vErr;
    views = new Map((v ?? []).map((r) => [r.article_id, Number(r.views)]));
  }
  const total = count ?? 0;
  return { rows, views, total, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
}

export async function loadEditorOptions(ctx: StaffContext) {
  const [cats, tags, locs, people] = await Promise.all([
    ctx.supabase.from("categories").select("id, name, slug, is_active").order("sort_order").order("name"),
    ctx.supabase.from("tags").select("id, name").order("name").limit(1000),
    ctx.supabase.from("locations").select("id, name, kind, parent_id").eq("is_active", true).order("sort_order").order("name"),
    ctx.supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
  ]);
  for (const r of [cats, tags, locs, people]) if (r.error) throw r.error;
  return {
    categories: cats.data ?? [],
    tags: tags.data ?? [],
    locations: locs.data ?? [],
    people: people.data ?? [],
  };
}
export type EditorOptions = Awaited<ReturnType<typeof loadEditorOptions>>;

export interface PickedImage {
  id: string;
  url: string | null;
  alt_text: string | null;
  caption: string | null;
  credit: string | null;
}

function toPicked(m: MediaSummary | null): PickedImage | null {
  return m ? { id: m.id, url: mediaUrl(m), alt_text: m.alt_text, caption: m.caption, credit: m.credit } : null;
}

export async function getArticleForEdit(ctx: StaffContext, id: string) {
  const { data, error } = await ctx.supabase
    .from("articles")
    .select(
      `*,
       category:categories!articles_category_id_fkey(slug),
       image:media_assets!articles_featured_image_id_fkey(${MEDIA}),
       og:media_assets!articles_og_image_id_fkey(${MEDIA}),
       article_tags(tag_id),
       article_contributors(profile_id, role_label, position),
       related_articles!related_articles_article_id_fkey(position, related:articles!related_articles_related_article_id_fkey(id, title, status))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Database["public"]["Tables"]["articles"]["Row"] & {
    category: { slug: string } | null;
    image: MediaSummary | null;
    og: MediaSummary | null;
    article_tags: { tag_id: string }[];
    article_contributors: { profile_id: string; role_label: string; position: number }[];
    related_articles: { position: number; related: { id: string; title: string; status: ArticleStatus } | null }[];
  };
  const { data: canEdit, error: ceErr } = await ctx.supabase.rpc("can_edit_article", { p_article_id: id });
  if (ceErr) throw ceErr;

  const { image, og, article_tags, article_contributors, related_articles, category, ...article } = row;
  return {
    article,
    categorySlug: category?.slug ?? null,
    canEdit: Boolean(canEdit),
    image: toPicked(image),
    og: toPicked(og),
    tagIds: article_tags.map((t) => t.tag_id),
    contributors: [...article_contributors].sort((a, b) => a.position - b.position).map(({ profile_id, role_label }) => ({ profile_id, role_label })),
    related: [...related_articles]
      .sort((a, b) => a.position - b.position)
      .map((r) => r.related)
      .filter((r): r is NonNullable<typeof r> => Boolean(r)),
  };
}
export type ArticleForEdit = NonNullable<Awaited<ReturnType<typeof getArticleForEdit>>>;

/** Unsaved article for the "New article" editor. Mirrors the column defaults; nothing is written until the first save. */
export function blankArticleForEdit(authorId: string): ArticleForEdit {
  const now = new Date().toISOString();
  return {
    article: {
      id: "",
      slug: "",
      title: "",
      subtitle: null,
      excerpt: null,
      body: { type: "doc", content: [{ type: "paragraph" }] },
      body_html: "",
      body_text: "",
      status: "draft",
      category_id: null,
      location_id: null,
      author_id: authorId,
      featured_image_id: null,
      og_image_id: null,
      is_featured: false,
      is_breaking: false,
      is_editors_pick: false,
      allow_comments: true,
      seo_title: null,
      seo_description: null,
      canonical_url: null,
      source_attribution: null,
      correction_note: null,
      reading_minutes: 1,
      published_at: null,
      first_published_at: null,
      content_updated_at: null,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      approved_by: null,
      published_by: null,
      review_note: null,
      rejection_reason: null,
      archived_at: null,
      created_by: authorId,
      created_at: now,
      updated_at: now,
      search_vector: null,
    },
    categorySlug: null,
    canEdit: true,
    image: null,
    og: null,
    tagIds: [],
    contributors: [],
    related: [],
  };
}

export async function getArticleHistory(ctx: StaffContext, id: string) {
  const [revs, acts] = await Promise.all([
    ctx.supabase
      .from("article_revisions")
      .select("id, revision_number, title, note, created_at, author:profiles!article_revisions_created_by_fkey(display_name)")
      .eq("article_id", id)
      .order("revision_number", { ascending: false })
      .limit(100),
    ctx.supabase
      .from("content_activity_logs")
      .select("id, action, from_status, to_status, note, created_at, actor:profiles!content_activity_logs_actor_id_fkey(display_name)")
      .eq("entity_type", "article")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (revs.error) throw revs.error;
  if (acts.error) throw acts.error;
  return {
    revisions: (revs.data ?? []) as unknown as { id: string; revision_number: number; title: string; note: string | null; created_at: string; author: { display_name: string } | null }[],
    activity: (acts.data ?? []) as unknown as {
      id: number;
      action: string;
      from_status: string | null;
      to_status: string | null;
      note: string | null;
      created_at: string;
      actor: { display_name: string } | null;
    }[],
  };
}

/** Load ANY article the session may view (drafts included, per RLS) shaped for <ArticleView>. */
export async function getArticlePreview(ctx: StaffContext, id: string): Promise<{ detail: ArticleDetail; status: ArticleStatus } | null> {
  const { data, error } = await ctx.supabase
    .from("articles")
    .select(
      `id, slug, title, subtitle, excerpt, body_html, status, published_at, first_published_at, content_updated_at, reading_minutes,
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
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Omit<ArticleDetail, "tags" | "contributors" | "related_ids"> & {
    status: ArticleStatus;
    article_tags: { tag: { id: string; slug: string; name: string } | null }[];
    article_contributors: { role_label: string; position: number; profile: { id: string; display_name: string } | null }[];
    related_articles: { related_article_id: string; position: number }[];
  };
  const { article_tags, article_contributors, related_articles, status, ...rest } = row;
  return {
    status,
    detail: {
      ...rest,
      tags: article_tags.map((t) => t.tag).filter((t): t is NonNullable<typeof t> => Boolean(t)),
      contributors: [...article_contributors].sort((a, b) => a.position - b.position),
      related_ids: [...related_articles].sort((a, b) => a.position - b.position).map((r) => r.related_article_id),
    },
  };
}
