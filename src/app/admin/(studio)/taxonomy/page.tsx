import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Notice, PageHeader, Table } from "@/components/studio/ui";
import { categoryOp } from "./actions";
import { TaxonomyTabs } from "./tabs";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const ctx = await requireStaffPage("taxonomy.manage");
  const { data: categories, error } = await ctx.supabase
    .from("categories")
    .select("id, name, slug, is_active, is_featured, sort_order, articles(count)")
    .order("sort_order")
    .order("name");

  return (
    <>
      <PageHeader
        title="Categories & tags"
        description="Categories are the main sections of the site (e.g. Pulitika, Kalusugan). Tags are more specific topics within articles."
        actions={
          <Link href="/admin/taxonomy/categories/new" className="btn btn-primary min-h-10 px-4 text-sm">
            New category
          </Link>
        }
      />
      <TaxonomyTabs current="/admin/taxonomy" />
      {error ? (
        <Notice tone="error">Couldn’t load categories.</Notice>
      ) : !categories?.length ? (
        <Empty title="No categories yet">Create the first category so articles can be published.</Empty>
      ) : (
        <Table head={["Order", "Category", "Status", "Articles", "Actions"]}>
          {categories.map((c, i) => (
            <tr key={c.id}>
              <td className="w-24">
                <ActionForm action={categoryOp} className="flex gap-1">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton name="op" value="up" variant="ghost" pendingLabel="…" className={i === 0 ? "invisible" : ""}>
                    <span aria-hidden="true">↑</span>
                    <span className="sr-only">Move {c.name} up</span>
                  </SubmitButton>
                  <SubmitButton name="op" value="down" variant="ghost" pendingLabel="…" className={i === categories.length - 1 ? "invisible" : ""}>
                    <span aria-hidden="true">↓</span>
                    <span className="sr-only">Move {c.name} down</span>
                  </SubmitButton>
                </ActionForm>
              </td>
              <td>
                <Link href={`/admin/taxonomy/categories/${c.id}`} className="font-semibold text-ink hover:text-brand">
                  {c.name}
                </Link>
                <p className="text-xs text-muted">/{c.slug}</p>
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  {c.is_active ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}
                  {c.is_featured && <Badge tone="blue">Featured</Badge>}
                </div>
              </td>
              <td className="tabular-nums">{c.articles[0]?.count ?? 0}</td>
              <td>
                <ActionForm action={categoryOp}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton name="op" value="toggle" variant="outline" pendingLabel="One moment…">
                    {c.is_active ? "Hide" : "Activate"}
                  </SubmitButton>
                </ActionForm>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-muted">Article counts include only articles your account can see (all statuses).</p>
    </>
  );
}
