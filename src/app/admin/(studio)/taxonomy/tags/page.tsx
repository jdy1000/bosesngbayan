import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, Field, Notice, PageHeader, Pagination, Panel, Table, withParams } from "@/components/studio/ui";
import { deleteTag, saveTag } from "../actions";
import { TaxonomyTabs } from "../tabs";

export const metadata = { title: "Tags" };

const PAGE_SIZE = 50;

export default async function TagsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("taxonomy.manage");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  let query = ctx.supabase
    .from("tags")
    .select("id, name, slug, description, article_tags(count)", { count: "exact" })
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`name.ilike.${like},slug.ilike.${like}`);
  }
  const { data: tags, count, error } = await query;

  return (
    <>
      <PageHeader eyebrow="Publication structure" title="Site categories" description="Tags are specific topics (e.g. “jeepney modernization”) that can be attached to many articles." />
      <TaxonomyTabs current="/admin/taxonomy/tags" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <form className="mb-4 flex flex-wrap gap-3" role="search">
            <label htmlFor="q" className="sr-only">
              Search tags
            </label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Search tags…" className="field min-w-56 flex-1" />
            <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
              Search
            </button>
          </form>
          {error ? (
            <Notice tone="error">Couldn’t load tags.</Notice>
          ) : !tags?.length ? (
            <Empty bare title={q ? "No matching tags" : "No tags yet"}>Create a tag in the right panel or while editing an article.</Empty>
          ) : (
            <>
              <Table head={["Tag", "Articles", "Actions"]}>
                {tags.map((t) => {
                  const used = t.article_tags[0]?.count ?? 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <p className="font-semibold text-ink">{t.name}</p>
                        <p className="text-xs text-muted">
                          <Link href={`/tag/${t.slug}`} target="_blank" className="hover:text-brand">
                            /tag/{t.slug}
                          </Link>
                        </p>
                      </td>
                      <td className="tabular-nums">{used}</td>
                      <td>
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold text-brand">Edit</summary>
                          <ActionForm action={saveTag} className="mt-3 space-y-3">
                            <input type="hidden" name="id" value={t.id} />
                            <TagFields name={t.name} slug={t.slug} description={t.description} idPrefix={t.id} />
                            <SubmitButton variant="outline">Save</SubmitButton>
                          </ActionForm>
                          <ActionForm
                            action={deleteTag}
                            className="mt-3"
                            confirm={used ? `Delete the tag? It will be removed from ${used} ${used === 1 ? "article" : "articles"}.` : "Delete this tag?"}
                          >
                            <input type="hidden" name="id" value={t.id} />
                            <SubmitButton variant="ghost" pendingLabel="Deleting…">
                              Delete
                            </SubmitButton>
                          </ActionForm>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </Table>
              <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)} hrefFor={(n) => withParams("/admin/taxonomy/tags", { q, page: n })} />
            </>
          )}
        </div>
        <Panel title="New tag">
          <ActionForm action={saveTag} resetOnSuccess className="space-y-3">
            <TagFields idPrefix="new" />
            <SubmitButton>Create tag</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}

function TagFields({ name, slug, description, idPrefix }: { name?: string; slug?: string; description?: string | null; idPrefix: string }) {
  return (
    <>
      <Field label="Name" htmlFor={`${idPrefix}-name`}>
        <input id={`${idPrefix}-name`} name="name" required maxLength={80} defaultValue={name} className="field" />
      </Field>
      <Field label="Slug" htmlFor={`${idPrefix}-slug`} hint="Blank = generated from the name.">
        <input id={`${idPrefix}-slug`} name="slug" maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={slug} className="field" />
      </Field>
      <Field label="Description" htmlFor={`${idPrefix}-description`}>
        <textarea id={`${idPrefix}-description`} name="description" rows={2} maxLength={600} defaultValue={description ?? ""} className="field py-2" />
      </Field>
    </>
  );
}
