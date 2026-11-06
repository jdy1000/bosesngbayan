import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { PageHeader, Panel } from "@/components/studio/ui";
import { getArticleForEdit, loadEditorOptions } from "@/lib/studio/articles";
import { ArticleEditor } from "../_components/article-editor";
import { deleteArticle, duplicateArticle } from "../actions";

export const metadata: Metadata = { title: "Edit article" };

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
      <PageHeader title={data.article.title} breadcrumb={[{ label: "Articles", href: "/admin/articles" }]} />
      {/* Remount after a status change / restore so the form reflects the server's latest version. */}
      <ArticleEditor key={data.article.updated_at} data={data} options={options} perms={perms} userId={ctx.userId} />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {has("articles.create") && (
          <Panel title="Duplicate" description="Creates a new draft copy (no status, schedule or homepage flags).">
            <ActionForm action={duplicateArticle}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton variant="outline" pendingLabel="Copying…">
                Make a copy
              </SubmitButton>
            </ActionForm>
          </Panel>
        )}
        {has("articles.delete") && (
          <Panel title="Delete permanently" description="Its revisions, comments and credits are deleted too. This cannot be undone. Unpublish or archive it first if it is published.">
            <ActionForm action={deleteArticle} confirm="Permanently delete this article?" className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <label className="block text-sm font-semibold text-ink">
                Type the title to confirm
                <input name="confirm_title" className="field mt-1" autoComplete="off" required />
              </label>
              <SubmitButton variant="danger" pendingLabel="Deleting…">
                Delete
              </SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
