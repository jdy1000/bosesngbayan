import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Field, Notice, PageHeader, Panel, Table } from "@/components/studio/ui";
import { deleteLocation, saveLocation } from "../place-actions";
import { LOCATION_KINDS, LOCATION_KIND_LABELS, type LocationKind } from "../location-kinds";
import { TaxonomyTabs } from "../tabs";

export const metadata = { title: "Locations" };

interface Loc {
  id: string;
  name: string;
  slug: string;
  kind: LocationKind;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

/** Depth-first order so each place appears under its parent. */
function toTree(rows: Loc[]): { loc: Loc; depth: number }[] {
  const children = new Map<string | null, Loc[]>();
  for (const r of rows) children.set(r.parent_id, [...(children.get(r.parent_id) ?? []), r]);
  const out: { loc: Loc; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const loc of children.get(parent) ?? []) {
      out.push({ loc, depth });
      walk(loc.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default async function LocationsPage() {
  const ctx = await requireStaffPage("taxonomy.manage");
  const { data, error } = await ctx.supabase.from("locations").select("id, name, slug, kind, parent_id, sort_order, is_active").order("sort_order").order("name");
  const rows = (data ?? []) as Loc[];
  const tree = toTree(rows);

  return (
    <>
      <PageHeader eyebrow="Publication structure" title="Site categories" description="Place hierarchy for regional news: island group → region → province → city/town." />
      <TaxonomyTabs current="/admin/taxonomy/locations" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {error ? (
            <Notice tone="error">Couldn’t load locations.</Notice>
          ) : !tree.length ? (
            <Empty title="No locations yet">Start with the island groups: Luzon, Visayas and Mindanao.</Empty>
          ) : (
            <Table head={["Location", "Type", "Status", "Actions"]}>
              {tree.map(({ loc, depth }) => (
                <tr key={loc.id}>
                  <td>
                    <span style={{ paddingLeft: `${depth * 1.25}rem` }} className="inline-block font-semibold text-ink">
                      {depth > 0 && <span aria-hidden="true" className="mr-1 text-muted">└</span>}
                      {loc.name}
                    </span>
                    <p className="text-xs text-muted" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                      /rehiyon/{loc.slug}
                    </p>
                  </td>
                  <td className="text-ink-soft">{LOCATION_KIND_LABELS[loc.kind]}</td>
                  <td>{loc.is_active ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</td>
                  <td>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-brand">Edit</summary>
                      <ActionForm action={saveLocation} className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={loc.id} />
                        <LocationFields value={loc} all={rows} idPrefix={loc.id} />
                        <SubmitButton variant="outline">Save</SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteLocation} className="mt-3" confirm={`Delete ${loc.name}?`}>
                        <input type="hidden" name="id" value={loc.id} />
                        <SubmitButton variant="ghost" pendingLabel="Deleting…">
                          Delete
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <Panel title="New location">
          <ActionForm action={saveLocation} resetOnSuccess className="space-y-3">
            <LocationFields all={rows} idPrefix="new" />
            <SubmitButton>Add</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}

function LocationFields({ value, all, idPrefix }: { value?: Loc; all: Loc[]; idPrefix: string }) {
  const parents = all.filter((l) => l.kind !== "city" && l.id !== value?.id);
  return (
    <>
      <Field label="Name" htmlFor={`${idPrefix}-name`}>
        <input id={`${idPrefix}-name`} name="name" required maxLength={120} defaultValue={value?.name} className="field" />
      </Field>
      <Field label="Slug" htmlFor={`${idPrefix}-slug`} hint="Blank = generated from the name.">
        <input id={`${idPrefix}-slug`} name="slug" maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={value?.slug} className="field" />
      </Field>
      <Field label="Type" htmlFor={`${idPrefix}-kind`}>
        <select id={`${idPrefix}-kind`} name="kind" defaultValue={value?.kind ?? "region"} className="field">
          {LOCATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {LOCATION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Parent" htmlFor={`${idPrefix}-parent`} hint="None for an island group. Region → island group, province → region, city → province.">
        <select id={`${idPrefix}-parent`} name="parent_id" defaultValue={value?.parent_id ?? ""} className="field">
          <option value="">— None —</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({LOCATION_KIND_LABELS[p.kind]})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sort order" htmlFor={`${idPrefix}-sort`}>
        <input id={`${idPrefix}-sort`} name="sort_order" type="number" defaultValue={value?.sort_order ?? 0} className="field" />
      </Field>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={value?.is_active ?? true} className="size-4" />
        Active
      </label>
    </>
  );
}
