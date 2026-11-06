import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { ARTICLE_STATUS, Empty, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { getArticleHistory } from "@/lib/studio/articles";
import { restoreArticleRevision } from "../../actions";

export const metadata: Metadata = { title: "Kasaysayan ng artikulo" };

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
        title="Kasaysayan"
        description={article.title}
        breadcrumb={[
          { label: "Mga Artikulo", href: "/admin/articles" },
          { label: "Editor", href: `/admin/articles/${id}` },
        ]}
        actions={<StatusBadge status={article.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Mga rebisyon"
          description="Nagagawa sa bawat manwal na pag-save, pagsumite, pag-publish at pag-iskedyul. Ang pag-restore ay nagbabalik ng nilalaman, SEO at tag — hindi ang status."
        >
          {revisions.length === 0 ? (
            <Empty title="Wala pang rebisyon." />
          ) : (
            <ol className="divide-y divide-line">
              {revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      #{r.revision_number} · {r.title}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(r.created_at)} · {r.author?.display_name ?? "Sistema"}
                      {r.note && ` · ${r.note}`}
                    </p>
                  </div>
                  {canEdit && (
                    <ActionForm action={restoreArticleRevision} confirm={`Ibalik ang rebisyon #${r.revision_number}? Ise-save muna ang kasalukuyang bersyon bilang rebisyon.`}>
                      <input type="hidden" name="revision_id" value={r.id} />
                      <SubmitButton variant="outline" pendingLabel="Ibinabalik…">
                        I-restore
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Aktibidad sa workflow" description="Mga pagbabago ng status, sino ang gumawa, at mga tala ng reviewer.">
          {activity.length === 0 ? (
            <Empty title="Wala pang aktibidad." />
          ) : (
            <ol className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <p className="text-ink">
                    <strong className="font-semibold">{a.actor?.display_name ?? (a.action === "scheduler" ? "Scheduler" : "Sistema")}</strong>{" "}
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
