import "server-only";
import type { StaffContext } from "@/lib/auth/session";

export interface StudioNotice {
  label: string;
  href: string;
  count: number;
}

/**
 * Work waiting for the signed-in staff member, for the top-bar bell. Each count runs only when the
 * member holds the permission for that queue, and through their own session (RLS applies).
 */
export async function getStudioNotices(ctx: StaffContext): Promise<StudioNotice[]> {
  const db = ctx.supabase;
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const none = Promise.resolve(0);
  const canReview = ctx.permissions.has("articles.review");
  const canModerate = ctx.permissions.has("moderation.manage");

  const [review, posts, comments, reports] = await Promise.all([
    canReview ? count(db.from("articles").select("id", { count: "exact", head: true }).eq("status", "pending_review")) : none,
    canModerate ? count(db.from("community_posts").select("id", { count: "exact", head: true }).eq("status", "pending")) : none,
    canModerate ? count(db.from("comments").select("id", { count: "exact", head: true }).eq("status", "pending")) : none,
    canModerate ? count(db.from("moderation_reports").select("id", { count: "exact", head: true }).eq("status", "open")) : none,
  ]);

  return [
    { label: "article(s) awaiting review", href: "/admin/articles?status=pending_review", count: review },
    { label: "Usap Bayan post(s) pending", href: "/admin/moderation?tab=posts", count: posts },
    { label: "comment(s) pending", href: "/admin/moderation?tab=comments", count: comments },
    { label: "open report(s)", href: "/admin/moderation?tab=reports", count: reports },
  ].filter((n) => n.count > 0);
}
