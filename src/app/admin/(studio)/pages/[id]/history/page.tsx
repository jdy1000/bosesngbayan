import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, PageHeader, Panel } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { getPageRevisions } from "@/lib/studio/pages";
import { restorePageRevision } from "../../actions";

export const metadata: Metadata = { title: "Page revisions" };

export default async function PageHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("pages.manage");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: page } = await ctx.supabase.from("pages").select("id, title").eq("id", id).maybeSingle();
  if (!page) notFound();
  const revisions = await getPageRevisions(ctx, id);

  return (
    <>
      <PageHeader
        title="Revisions"
        description={page.title}
        breadcrumb={[
          { label: "Pages", href: "/admin/pages" },
          { label: "Editor", href: `/admin/pages/${id}` },
        ]}
      />
      <Panel description="Created on every manual save and status change. Restoring brings back the title, slug, summary, content and SEO — not the status.">
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
                <ActionForm action={restorePageRevision} confirm={`Restore revision #${r.revision_number}? The current version will be saved as a revision first.`}>
                  <input type="hidden" name="revision_id" value={r.id} />
                  <SubmitButton variant="outline" pendingLabel="Restoring…">
                    Restore
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
