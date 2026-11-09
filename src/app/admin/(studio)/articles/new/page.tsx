import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { PageHeader } from "@/components/studio/ui";
import { blankArticleForEdit, loadEditorOptions } from "@/lib/studio/articles";
import { ArticleEditor } from "../_components/article-editor";

export const metadata: Metadata = { title: "New article" };

/** Opens the full editor straight away; the draft is only created on the first save or publishing action. */
export default async function NewArticlePage() {
  const ctx = await requireStaffPage("articles.create");
  const options = await loadEditorOptions(ctx);
  const has = (p: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(p);
  const perms = {
    submit: has("articles.submit"),
    review: has("articles.review"),
    publish: has("articles.publish"),
    archive: false, // nothing to archive before the article exists
    editAny: has("articles.edit_any"),
    taxonomy: has("taxonomy.manage"),
  };

  return (
    <>
      <PageHeader
        title="Create article"
        description="Start a draft, add your content, and publish when it’s ready."
      />
      <ArticleEditor data={blankArticleForEdit(ctx.userId)} options={options} perms={perms} userId={ctx.userId} isNew />
    </>
  );
}
