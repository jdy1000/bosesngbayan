import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { PageHeader, Panel } from "@/components/studio/ui";
import { categoryOp } from "../../actions";
import { CategoryForm } from "../category-form";

export const metadata = { title: "Kategorya" };

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
        breadcrumb={[{ label: "Kategorya at Tag", href: "/admin/taxonomy" }]}
        actions={
          category.is_active && (
            <Link href={`/paksa/${category.slug}`} target="_blank" className="text-sm font-semibold text-brand hover:underline">
              Tingnan sa site ↗
            </Link>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <CategoryForm values={category} image={image} />
        </Panel>
        <Panel title="Burahin">
          {articleCount ? (
            <p className="text-sm text-ink-soft">
              Ginagamit ng <strong>{articleCount}</strong> artikulo ang kategoryang ito kaya hindi ito mabubura. Ilipat muna ang mga artikulo, o itago na
              lamang ang kategorya.
            </p>
          ) : (
            <ActionForm action={categoryOp} confirm="Burahin ang kategoryang ito? Aalisin din ang mga trending topic na tumuturo rito.">
              <input type="hidden" name="id" value={category.id} />
              <p className="mb-3 text-sm text-ink-soft">Walang artikulong gumagamit nito. Ang mga poll at post na naka-link ay mawawalan ng kategorya.</p>
              <SubmitButton name="op" value="delete" variant="danger" pendingLabel="Binubura…">
                Burahin ang kategorya
              </SubmitButton>
            </ActionForm>
          )}
        </Panel>
      </div>
    </>
  );
}
