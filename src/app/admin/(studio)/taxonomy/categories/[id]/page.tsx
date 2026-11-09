import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { PageHeader, Panel } from "@/components/studio/ui";
import { categoryOp } from "../../actions";
import { CategoryForm } from "../category-form";

export const metadata = { title: "Category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("taxonomy.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ data: category }, { count: articleCount }] = await Promise.all([
    ctx.supabase
      .from("categories")
      .select("id, name, slug, description, seo_title, seo_description, is_featured, is_active, image:media_assets(id, storage_path, external_url, alt_text, file_name)")
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase.from("articles").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);
  if (!category) notFound();
  const image = category.image
    ? { id: category.image.id, url: mediaUrl(category.image), alt_text: category.image.alt_text, file_name: category.image.file_name }
    : null;

  return (
    <>
      <PageHeader
        title={category.name}
        breadcrumb={[{ label: "Site categories", href: "/admin/taxonomy" }]}
        actions={
          category.is_active && (
            <Link href={`/paksa/${category.slug}`} target="_blank" className="text-sm font-semibold text-brand hover:underline">
              View on site ↗
            </Link>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <CategoryForm values={category} image={image} />
        </Panel>
        <Panel title="Delete">
          {articleCount ? (
            <p className="text-sm text-ink-soft">
              This category is used by <strong>{articleCount}</strong> {articleCount === 1 ? "article" : "articles"}, so it can’t be deleted. Move the articles first, or
              hide the category instead.
            </p>
          ) : (
            <ActionForm action={categoryOp} confirm="Delete this category? Trending topics pointing to it will be removed too.">
              <input type="hidden" name="id" value={category.id} />
              <p className="mb-3 text-sm text-ink-soft">No articles use it. Linked polls and posts will lose their category.</p>
              <SubmitButton name="op" value="delete" variant="danger" pendingLabel="Deleting…">
                Delete category
              </SubmitButton>
            </ActionForm>
          )}
        </Panel>
      </div>
    </>
  );
}
