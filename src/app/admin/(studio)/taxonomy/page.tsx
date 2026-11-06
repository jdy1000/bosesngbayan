import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Notice, PageHeader, Table } from "@/components/studio/ui";
import { categoryOp } from "./actions";
import { TaxonomyTabs } from "./tabs";

export const metadata = { title: "Mga kategorya" };

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
        title="Kategorya at Tag"
        description="Ang mga kategorya ang pangunahing seksyon ng site (hal. Pulitika, Kalusugan). Ang mga tag ay mas tiyak na paksa sa loob ng mga artikulo."
        actions={
          <Link href="/admin/taxonomy/categories/new" className="btn btn-primary min-h-10 px-4 text-sm">
            Bagong kategorya
          </Link>
        }
      />
      <TaxonomyTabs current="/admin/taxonomy" />
      {error ? (
        <Notice tone="error">Hindi makuha ang mga kategorya.</Notice>
      ) : !categories?.length ? (
        <Empty title="Wala pang kategorya">Gumawa ng unang kategorya para makapaglathala ng mga artikulo.</Empty>
      ) : (
        <Table head={["Ayos", "Kategorya", "Status", "Mga artikulo", "Aksyon"]}>
          {categories.map((c, i) => (
            <tr key={c.id}>
              <td className="w-24">
                <ActionForm action={categoryOp} className="flex gap-1">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton name="op" value="up" variant="ghost" pendingLabel="…" className={i === 0 ? "invisible" : ""}>
                    <span aria-hidden="true">↑</span>
                    <span className="sr-only">Itaas ang {c.name}</span>
                  </SubmitButton>
                  <SubmitButton name="op" value="down" variant="ghost" pendingLabel="…" className={i === categories.length - 1 ? "invisible" : ""}>
                    <span aria-hidden="true">↓</span>
                    <span className="sr-only">Ibaba ang {c.name}</span>
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
                  {c.is_active ? <Badge tone="green">Aktibo</Badge> : <Badge>Nakatago</Badge>}
                  {c.is_featured && <Badge tone="blue">Featured</Badge>}
                </div>
              </td>
              <td className="tabular-nums">{c.articles[0]?.count ?? 0}</td>
              <td>
                <ActionForm action={categoryOp}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton name="op" value="toggle" variant="outline" pendingLabel="Sandali…">
                    {c.is_active ? "Itago" : "I-activate"}
                  </SubmitButton>
                </ActionForm>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-muted">Ang bilang ng artikulo ay batay sa mga artikulong nakikita ng iyong account (lahat ng status).</p>
    </>
  );
}
