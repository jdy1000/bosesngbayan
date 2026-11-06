import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { PageHeader, Panel } from "@/components/studio/ui";
import { getArticleForEdit, loadEditorOptions } from "@/lib/studio/articles";
import { ArticleEditor } from "../_components/article-editor";
import { deleteArticle, duplicateArticle } from "../actions";

export const metadata: Metadata = { title: "I-edit ang artikulo" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, options] = await Promise.all([getArticleForEdit(ctx, id), loadEditorOptions(ctx)]);
  if (!data) notFound();
  const has = (p: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(p);
  const perms = {
    submit: has("articles.submit"),
    review: has("articles.review"),
    publish: has("articles.publish"),
    archive: has("articles.archive"),
    editAny: has("articles.edit_any"),
    taxonomy: has("taxonomy.manage"),
  };

  return (
    <>
      <PageHeader title={data.article.title} breadcrumb={[{ label: "Mga Artikulo", href: "/admin/articles" }]} />
      {/* Remount after a status change / restore so the form reflects the server's latest version. */}
      <ArticleEditor key={data.article.updated_at} data={data} options={options} perms={perms} userId={ctx.userId} />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {has("articles.create") && (
          <Panel title="Duplicate" description="Gagawa ng bagong draft na kopya (walang status, iskedyul o homepage flags).">
            <ActionForm action={duplicateArticle}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton variant="outline" pendingLabel="Kinokopya…">
                Gumawa ng kopya
              </SubmitButton>
            </ActionForm>
          </Panel>
        )}
        {has("articles.delete") && (
          <Panel title="Burahin nang permanente" description="Mabubura rin ang mga rebisyon, komento at credits nito. Hindi ito maibabalik. I-unpublish o i-archive muna kung nakalathala.">
            <ActionForm action={deleteArticle} confirm="Permanenteng burahin ang artikulong ito?" className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <label className="block text-sm font-semibold text-ink">
                I-type ang pamagat para kumpirmahin
                <input name="confirm_title" className="field mt-1" autoComplete="off" required />
              </label>
              <SubmitButton variant="danger" pendingLabel="Binubura…">
                Burahin
              </SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
