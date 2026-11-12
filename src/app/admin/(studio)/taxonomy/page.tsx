import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, Field, Notice, PageHeader, Panel, RecordList, RecordRow, RecordTitle } from "@/components/studio/ui";
import { categoryOp, createCategory, deleteCategory } from "./actions";
import { TaxonomyTabs } from "./tabs";

export const metadata = { title: "Categories" };

// SubmitButton sets its own size, so the row size needs the important flag.
const SMALL = "!min-h-9 !px-3 !text-[13px]";

/**
 * Category list and quick add side by side, as on the Newsmaker console's setup page. Reordering, article counts
 * and the full form (image, SEO, featured) at /admin/taxonomy/categories/{id} are Boses additions.
 */
export default async function CategoriesPage() {
  const ctx = await requireStaffPage("taxonomy.manage");
  const { data, error } = await ctx.supabase
    .from("categories")
    .select("id, name, slug, description, is_active, is_featured, sort_order, articles(count)")
    .order("sort_order")
    .order("name");
  const categories = data ?? [];
  const visible = categories.filter((c) => c.is_active).length;

  return (
    <>
      <PageHeader
        eyebrow="Publication structure"
        title="Site categories"
        description="Categories are the main sections of the site (e.g. Pulitika, Kalusugan). Tags are more specific topics within articles."
      />
      <TaxonomyTabs current="/admin/taxonomy" />

      <div className="grid items-start gap-6 min-[1101px]:grid-cols-2">
        <Panel flush title="Categories" description={error ? undefined : `${visible} visible · ${categories.length - visible} hidden`}>
          {error ? (
            <div className="px-[22px] py-5">
              <Notice tone="error">Couldn’t load categories.</Notice>
            </div>
          ) : categories.length === 0 ? (
            <Empty bare title="No categories">
              Create the first editorial section.
            </Empty>
          ) : (
            <RecordList label="Categories">
              {categories.map((c, i) => {
                const used = c.articles[0]?.count ?? 0;
                return (
                  <RecordRow
                    key={c.id}
                    compact
                    actions={
                      <ActionForm action={categoryOp}>
                        <input type="hidden" name="id" value={c.id} />
                        <div className="flex gap-1">
                          <SubmitButton name="op" value="up" variant="ghost" pendingLabel="…" className={`!min-h-9 !px-2.5 ${i === 0 ? "invisible" : ""}`}>
                            <span aria-hidden="true">↑</span>
                            <span className="sr-only">Move {c.name} up</span>
                          </SubmitButton>
                          <SubmitButton name="op" value="down" variant="ghost" pendingLabel="…" className={`!min-h-9 !px-2.5 ${i === categories.length - 1 ? "invisible" : ""}`}>
                            <span aria-hidden="true">↓</span>
                            <span className="sr-only">Move {c.name} down</span>
                          </SubmitButton>
                        </div>
                      </ActionForm>
                    }
                  >
                    <RecordTitle>{c.name}</RecordTitle>
                    <code className="text-xs text-ink-soft">{c.slug}</code>
                    <p className="mt-1.5 text-[13px] text-ink-soft">
                      <strong className="font-semibold text-ink">{c.is_active ? "Visible" : "Hidden"}</strong>
                      {c.is_featured && " · Featured"}
                    </p>
                    {c.description && <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft">{c.description}</p>}
                    <p className="mt-1.5 text-xs tabular-nums text-muted">
                      {used} {used === 1 ? "article" : "articles"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <Link href={`/admin/taxonomy/categories/${c.id}`} className="btn btn-outline min-h-9 px-3 text-[13px]">
                        Edit<span className="sr-only"> {c.name}</span>
                      </Link>
                      <ActionForm action={categoryOp}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton name="op" value="toggle" variant="outline" pendingLabel="Updating…" className={SMALL}>
                          {c.is_active ? "Hide" : "Show"}
                          <span className="sr-only"> {c.name}</span>
                        </SubmitButton>
                      </ActionForm>
                    </div>
                    <details className="mt-2">
                      <summary className="w-fit cursor-pointer py-2 text-[13px] font-bold text-accent-700">
                        Delete category<span className="sr-only"> {c.name}</span>
                      </summary>
                      <ActionForm action={deleteCategory} className="mt-1 space-y-3">
                        <input type="hidden" name="id" value={c.id} />
                        <p className="text-xs leading-[1.5] text-muted">
                          Only unused categories can be deleted. Existing articles are never deleted. Trending topics pointing to it are removed, and linked polls and posts lose
                          their category.
                        </p>
                        <label className="block text-xs font-bold text-ink-soft">
                          Type {c.slug} to confirm
                          <input name="confirmation" required autoComplete="off" maxLength={140} className="field mt-[7px] font-normal" />
                        </label>
                        <SubmitButton variant="danger" pendingLabel="Deleting…" className={SMALL}>
                          Delete permanently
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  </RecordRow>
                );
              })}
            </RecordList>
          )}
        </Panel>

        <Panel title="Add category" description="Use a stable slug. Published URLs may depend on it.">
          <ActionForm action={createCategory} resetOnSuccess className="space-y-4">
            <Field label="Name" htmlFor="new-name">
              <input id="new-name" name="name" required maxLength={80} className="field" />
            </Field>
            <Field label="Slug" htmlFor="new-slug" hint="Lowercase letters, numbers and hyphens.">
              <input id="new-slug" name="slug" required maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoComplete="off" className="field" />
            </Field>
            <Field label="Description (optional)" htmlFor="new-description">
              <textarea id="new-description" name="description" rows={3} maxLength={600} className="field" />
            </Field>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <SubmitButton pendingLabel="Creating…">Create category</SubmitButton>
              <Link href="/admin/taxonomy/categories/new" className="text-[13px] font-bold text-brand hover:underline">
                More options
              </Link>
            </div>
          </ActionForm>
        </Panel>
      </div>
      <p className="mt-3 text-xs text-muted">Article counts include only articles your account can see (all statuses).</p>
    </>
  );
}
