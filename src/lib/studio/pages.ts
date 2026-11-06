import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { mediaUrl } from "@/lib/media";
import type { MediaSummary } from "@/lib/cms/articles";
import type { PageStatus } from "@/app/admin/(studio)/pages/status";

/** Studio page loaders (session client; RLS: pages.manage). */

export async function listStudioPages(ctx: StaffContext, status?: PageStatus) {
  let query = ctx.supabase.from("pages").select("id, slug, title, status, published_at, updated_at").order("title");
  if (status) query = query.eq("status", status);
  const { data, error } = await query.limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function getPageForEdit(ctx: StaffContext, id: string) {
  const { data, error } = await ctx.supabase
    .from("pages")
    .select("*, og:media_assets!pages_og_image_id_fkey(id, storage_path, external_url, alt_text, caption, credit, width, height)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { og, ...page } = data as unknown as Database["public"]["Tables"]["pages"]["Row"] & { og: MediaSummary | null };
  return { page, og: og ? { id: og.id, url: mediaUrl(og), alt_text: og.alt_text } : null };
}
export type PageForEdit = NonNullable<Awaited<ReturnType<typeof getPageForEdit>>>;

export async function getPageRevisions(ctx: StaffContext, id: string) {
  const { data, error } = await ctx.supabase
    .from("page_revisions")
    .select("id, revision_number, title, note, created_at, author:profiles!page_revisions_created_by_fkey(display_name)")
    .eq("page_id", id)
    .order("revision_number", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as { id: string; revision_number: number; title: string; note: string | null; created_at: string; author: { display_name: string } | null }[];
}
