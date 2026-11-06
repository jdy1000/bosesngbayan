import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, PageHeader, Panel } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { getPageRevisions } from "@/lib/studio/pages";
import { restorePageRevision } from "../../actions";

export const metadata: Metadata = { title: "Mga rebisyon ng pahina" };

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
        title="Mga rebisyon"
        description={page.title}
        breadcrumb={[
          { label: "Mga Pahina", href: "/admin/pages" },
          { label: "Editor", href: `/admin/pages/${id}` },
        ]}
      />
      <Panel description="Nagagawa sa bawat manwal na pag-save at pagbabago ng status. Ang pag-restore ay nagbabalik ng pamagat, slug, buod, nilalaman at SEO — hindi ang status.">
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
                <ActionForm action={restorePageRevision} confirm={`Ibalik ang rebisyon #${r.revision_number}? Ise-save muna ang kasalukuyang bersyon bilang rebisyon.`}>
                  <input type="hidden" name="revision_id" value={r.id} />
                  <SubmitButton variant="outline" pendingLabel="Ibinabalik…">
                    I-restore
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
