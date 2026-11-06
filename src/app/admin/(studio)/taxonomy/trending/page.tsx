import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Field, Notice, PageHeader, Panel, Table } from "@/components/studio/ui";
import { saveTrending, trendingOp } from "../place-actions";
import { TaxonomyTabs } from "../tabs";

export const metadata = { title: "Trending topics" };

interface Topic {
  id: string;
  label: string;
  category_id: string | null;
  tag_id: string | null;
  href: string | null;
  is_active: boolean;
}
type Option = { id: string; name: string };

export default async function TrendingPage() {
  const ctx = await requireStaffPage("taxonomy.manage");
  const [{ data: topics, error }, { data: categories }, { data: tags }] = await Promise.all([
    ctx.supabase
      .from("trending_topics")
      .select("id, label, category_id, tag_id, href, is_active, position, category:categories(name), tag:tags(name)")
      .order("position")
      .order("created_at"),
    ctx.supabase.from("categories").select("id, name").order("sort_order").order("name"),
    ctx.supabase.from("tags").select("id, name").order("name").limit(500),
  ]);

  return (
    <>
      <PageHeader
        title="Kategorya at Tag"
        description="Ang trending bar sa ilalim ng header. Editoryal na pinipili ang mga ito — hindi ito awtomatikong batay sa trapiko."
      />
      <TaxonomyTabs current="/admin/taxonomy/trending" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {error ? (
            <Notice tone="error">Hindi makuha ang mga trending topic.</Notice>
          ) : !topics?.length ? (
            <Empty title="Walang trending topic">Magdagdag gamit ang panel sa kanan.</Empty>
          ) : (
            <Table head={["Ayos", "Label", "Patutunguhan", "Status", "Aksyon"]}>
              {topics.map((t, i) => (
                <tr key={t.id}>
                  <td className="w-24">
                    <ActionForm action={trendingOp} className="flex gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton name="op" value="up" variant="ghost" pendingLabel="…" className={i === 0 ? "invisible" : ""}>
                        <span aria-hidden="true">↑</span>
                        <span className="sr-only">Itaas ang {t.label}</span>
                      </SubmitButton>
                      <SubmitButton name="op" value="down" variant="ghost" pendingLabel="…" className={i === topics.length - 1 ? "invisible" : ""}>
                        <span aria-hidden="true">↓</span>
                        <span className="sr-only">Ibaba ang {t.label}</span>
                      </SubmitButton>
                    </ActionForm>
                  </td>
                  <td className="font-semibold text-ink">{t.label}</td>
                  <td className="text-ink-soft">
                    {t.category ? `Kategorya: ${t.category.name}` : t.tag ? `Tag: ${t.tag.name}` : <code className="text-xs">{t.href}</code>}
                  </td>
                  <td>{t.is_active ? <Badge tone="green">Ipinapakita</Badge> : <Badge>Nakatago</Badge>}</td>
                  <td>
                    <div className="flex flex-wrap items-start gap-2">
                      <ActionForm action={trendingOp}>
                        <input type="hidden" name="id" value={t.id} />
                        <SubmitButton name="op" value="toggle" variant="outline" pendingLabel="Sandali…">
                          {t.is_active ? "Itago" : "Ipakita"}
                        </SubmitButton>
                      </ActionForm>
                      <details>
                        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold text-brand">I-edit</summary>
                        <ActionForm action={saveTrending} className="mt-3 w-72 space-y-3">
                          <input type="hidden" name="id" value={t.id} />
                          <TrendingFields value={t} categories={categories ?? []} tags={tags ?? []} idPrefix={t.id} />
                          <SubmitButton variant="outline">I-save</SubmitButton>
                        </ActionForm>
                        <ActionForm action={trendingOp} className="mt-3" confirm={`Alisin ang “${t.label}”?`}>
                          <input type="hidden" name="id" value={t.id} />
                          <SubmitButton name="op" value="delete" variant="ghost" pendingLabel="Inaalis…">
                            Alisin
                          </SubmitButton>
                        </ActionForm>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <Panel title="Bagong trending topic">
          <ActionForm action={saveTrending} resetOnSuccess className="space-y-3">
            <TrendingFields categories={categories ?? []} tags={tags ?? []} idPrefix="new" />
            <SubmitButton>Idagdag</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}

function TrendingFields({ value, categories, tags, idPrefix }: { value?: Topic; categories: Option[]; tags: Option[]; idPrefix: string }) {
  const target = value?.tag_id ? "tag" : value?.href ? "href" : "category";
  return (
    <>
      <Field label="Label" htmlFor={`${idPrefix}-label`} hint="Hanggang 60 character.">
        <input id={`${idPrefix}-label`} name="label" required maxLength={60} defaultValue={value?.label} className="field" />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink">Patutunguhan (pumili ng isa)</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="target" value="category" defaultChecked={target === "category"} className="size-4" />
            Kategorya
          </label>
          <select name="category_id" aria-label="Kategorya" defaultValue={value?.category_id ?? ""} className="field">
            <option value="">— Pumili —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="target" value="tag" defaultChecked={target === "tag"} className="size-4" />
            Tag
          </label>
          <select name="tag_id" aria-label="Tag" defaultValue={value?.tag_id ?? ""} className="field">
            <option value="">— Pumili —</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="target" value="href" defaultChecked={target === "href"} className="size-4" />
            Internal na link
          </label>
          <input name="href" aria-label="Internal na link" maxLength={500} placeholder="/paksa/kalusugan" defaultValue={value?.href ?? ""} className="field" />
        </div>
      </fieldset>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={value?.is_active ?? true} className="size-4" />
        Ipakita sa site
      </label>
    </>
  );
}
