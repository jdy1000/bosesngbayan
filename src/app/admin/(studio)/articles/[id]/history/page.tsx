import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { ARTICLE_STATUS, Empty, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { getArticleHistory } from "@/lib/studio/articles";
import { restoreArticleRevision } from "../../actions";

export const metadata: Metadata = { title: "Article history" };

export default async function ArticleHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: article } = await ctx.supabase.from("articles").select("id, title, status").eq("id", id).maybeSingle();
  if (!article) notFound();
  const [{ revisions, activity }, { data: canEdit }] = await Promise.all([
    getArticleHistory(ctx, id),
    ctx.supabase.rpc("can_edit_article", { p_article_id: id }),
  ]);

  return (
    <>
      <PageHeader
        title="History"
        description={article.title}
        breadcrumb={[
          { label: "Articles", href: "/admin/articles" },
          { label: "Editor", href: `/admin/articles/${id}` },
        ]}
        actions={<StatusBadge status={article.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Revisions"
          description="Created on every manual save, submission, publish and schedule. Restoring brings back content, SEO and tags — not the status."
        >
          {revisions.length === 0 ? (
            <Empty title="No revisions yet." />
          ) : (
            <ol className="divide-y divide-line">
              {revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      #{r.revision_number} · {r.title}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(r.created_at)} · {r.author?.display_name ?? "System"}
                      {r.note && ` · ${r.note}`}
                    </p>
                  </div>
                  {canEdit && (
                    <ActionForm action={restoreArticleRevision} confirm={`Restore revision #${r.revision_number}? The current version will be saved as a revision first.`}>
                      <input type="hidden" name="revision_id" value={r.id} />
                      <SubmitButton variant="outline" pendingLabel="Restoring…">
                        Restore
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Workflow activity" description="Status changes, who made them, and reviewer notes.">
          {activity.length === 0 ? (
            <Empty title="No activity yet." />
          ) : (
            <ol className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <p className="text-ink">
                    <strong className="font-semibold">{a.actor?.display_name ?? (a.action === "scheduler" ? "Scheduler" : "System")}</strong>{" "}
                    {a.from_status && a.to_status
                      ? `${ARTICLE_STATUS[a.from_status]?.label ?? a.from_status} → ${ARTICLE_STATUS[a.to_status]?.label ?? a.to_status}`
                      : a.action}
                  </p>
                  {a.note && <p className="mt-0.5 text-ink-soft">“{a.note}”</p>}
                  <p className="text-xs text-muted">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
