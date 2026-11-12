import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, truncate } from "@/lib/format";
import { PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { MODERATION_STATUS } from "../../labels";
import { ActivityHistory, DetailRow, ModerationPanel, ReportsPanel } from "../../parts";

export const metadata = { title: "Comment" };

export default async function ModerationCommentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("moderation.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ data: comment }, { data: reports }] = await Promise.all([
    ctx.supabase
      .from("comments")
      .select(
        "id, body, author_name, author_email, status, moderator_note, moderated_at, created_at, parent_id, community_post_id, article:articles(title, slug), post:community_posts(id, title)",
      )
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase
      .from("moderation_reports")
      .select("id, reason, details, status, resolution_note, resolved_at, created_at")
      .eq("comment_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!comment) notFound();

  const parent = comment.parent_id
    ? (await ctx.supabase.from("comments").select("author_name, body").eq("id", comment.parent_id).maybeSingle()).data
    : null;

  return (
    <>
      <PageHeader
        title={`Comment by ${comment.author_name}`}
        breadcrumb={[{ label: "Report inbox", href: "/admin/moderation?tab=comments" }]}
        description={<StatusBadge status={comment.status} map={MODERATION_STATUS} />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Full comment">
            {parent && (
              <blockquote className="mb-4 border-l-2 border-line pl-3 text-[13px] leading-[1.55] text-muted">
                Reply to {parent.author_name}: “{truncate(parent.body, 200)}”
              </blockquote>
            )}
            <p className="whitespace-pre-line break-words text-[15px] leading-[1.55] text-ink">{comment.body}</p>
          </Panel>
          <ReportsPanel reports={reports ?? []} />
          <ActivityHistory ctx={ctx} entityType="comment" entityId={comment.id} reportIds={(reports ?? []).map((r) => r.id)} />
        </div>
        <aside className="space-y-6">
          <ModerationPanel targetType="comment" targetId={comment.id} status={comment.status} currentNote={comment.moderator_note} />
          <Panel title="Details">
            <dl className="space-y-3.5">
              <DetailRow label="On">
                {comment.article ? (
                  <Link href={`/balita/${comment.article.slug}`} target="_blank" className="font-bold text-brand hover:underline">
                    {comment.article.title} <span aria-hidden="true">↗</span>
                  </Link>
                ) : comment.post ? (
                  <Link href={`/admin/moderation/posts/${comment.post.id}`} className="font-bold text-brand hover:underline">
                    {comment.post.title}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Email (staff only)">{comment.author_email ?? "Not provided"}</DetailRow>
              <DetailRow label="Submitted">{formatDateTime(comment.created_at)}</DetailRow>
              {comment.moderated_at && <DetailRow label="Last moderated">{formatDateTime(comment.moderated_at)}</DetailRow>}
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}
