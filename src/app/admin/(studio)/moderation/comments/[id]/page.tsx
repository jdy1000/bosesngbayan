import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, truncate } from "@/lib/format";
import { PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { MODERATION_STATUS } from "../../labels";
import { ActivityHistory, ModerationPanel, ReportsPanel } from "../../parts";

export const metadata = { title: "Komento" };

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
        title={`Komento ni ${comment.author_name}`}
        breadcrumb={[{ label: "Moderation", href: "/admin/moderation?tab=comments" }]}
        description={<StatusBadge status={comment.status} map={MODERATION_STATUS} />}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Buong komento">
            {parent && (
              <blockquote className="mb-4 border-l-4 border-line pl-3 text-sm text-muted">
                Tugon kay {parent.author_name}: “{truncate(parent.body, 200)}”
              </blockquote>
            )}
            <p className="whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-ink">{comment.body}</p>
          </Panel>
          <ReportsPanel reports={reports ?? []} />
          <ActivityHistory ctx={ctx} entityType="comment" entityId={comment.id} reportIds={(reports ?? []).map((r) => r.id)} />
        </div>
        <aside className="space-y-6">
          <ModerationPanel targetType="comment" targetId={comment.id} status={comment.status} currentNote={comment.moderator_note} />
          <Panel title="Detalye">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Sa</dt>
                <dd>
                  {comment.article ? (
                    <Link href={`/balita/${comment.article.slug}`} target="_blank" className="text-brand hover:underline">
                      {comment.article.title} ↗
                    </Link>
                  ) : comment.post ? (
                    <Link href={`/admin/moderation/posts/${comment.post.id}`} className="text-brand hover:underline">
                      {comment.post.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Email (staff lamang)</dt>
                <dd className="break-words">{comment.author_email ?? "Hindi ibinigay"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Isinumite</dt>
                <dd>{formatDateTime(comment.created_at)}</dd>
              </div>
              {comment.moderated_at && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Huling moderation</dt>
                  <dd>{formatDateTime(comment.moderated_at)}</dd>
                </div>
              )}
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}
