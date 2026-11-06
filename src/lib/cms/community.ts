import "server-only";
import { createPublicClient } from "@/lib/supabase/server";

export const COMMUNITY_KIND_LABELS = {
  perspective: "Pananaw",
  question: "Tanong ng komunidad",
  discussion: "Talakayan",
} as const;
export type CommunityKind = keyof typeof COMMUNITY_KIND_LABELS;

export interface CommunityPost {
  id: string;
  kind: CommunityKind;
  title: string;
  body: string;
  author_name: string;
  author_location: string | null;
  is_featured: boolean;
  allow_comments: boolean;
  published_at: string | null;
  category: { id: string; slug: string; name: string } | null;
}

// Column list must match the column-level grants for `anon` in migration 20261106000300.
const POST_SELECT = "id, kind, title, body, author_name, author_location, is_featured, allow_comments, published_at, category:categories(id, slug, name)";

export async function listApprovedPosts(opts: { kind?: CommunityKind; featuredOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 12));
  let query = createPublicClient()
    .from("community_posts")
    .select(POST_SELECT, { count: "exact" })
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false });
  if (opts.kind) query = query.eq("kind", opts.kind);
  if (opts.featuredOnly) query = query.eq("is_featured", true);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count ?? 0;
  return { items: (data ?? []) as unknown as CommunityPost[], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getApprovedPost(id: string): Promise<CommunityPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createPublicClient().from("community_posts").select(POST_SELECT).eq("id", id).eq("status", "approved").maybeSingle();
  if (error) throw error;
  return data as unknown as CommunityPost | null;
}

export interface PublicComment {
  id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export async function listApprovedComments(target: { articleId?: string; postId?: string }): Promise<PublicComment[]> {
  let query = createPublicClient()
    .from("comments")
    .select("id, parent_id, author_name, body, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(500);
  if (target.articleId) query = query.eq("article_id", target.articleId);
  else if (target.postId) query = query.eq("community_post_id", target.postId);
  else return [];
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
