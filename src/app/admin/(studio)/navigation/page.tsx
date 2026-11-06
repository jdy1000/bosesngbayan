import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Field, PageHeader, Panel } from "@/components/studio/ui";
import { createNavItem, deleteNavItem, moveNavItem, toggleNavItem, updateNavItem } from "./actions";

export const metadata: Metadata = { title: "Navigation" };

interface Item {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  label_en: string | null;
  href: string;
  position: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
}

export default async function NavigationPage() {
  const ctx = await requireStaffPage("navigation.manage");
  const [menusRes, itemsRes] = await Promise.all([
    ctx.supabase.from("navigation_menus").select("id, key, name").order("key"),
    ctx.supabase
      .from("navigation_items")
      .select("id, menu_id, parent_id, label, label_en, href, position, is_visible, open_in_new_tab")
      .order("position")
      .order("created_at"),
  ]);
  if (menusRes.error) throw menusRes.error;
  if (itemsRes.error) throw itemsRes.error;
  const items = itemsRes.data ?? [];

  return (
    <>
      <PageHeader
        title="Navigation"
        description="Links in the public site's header and footer. Dropdowns are one level deep (parent → sub-link). Changes appear on the site immediately."
      />
      {(menusRes.data ?? []).length === 0 && <Empty title="No navigation menus.">Menus are created by the database seed (header, footer_main, footer_legal).</Empty>}
      <div className="space-y-6">
        {(menusRes.data ?? []).map((menu) => {
          const own = items.filter((i) => i.menu_id === menu.id);
          const top = own.filter((i) => i.parent_id === null);
          return (
            <Panel key={menu.id} title={menu.name} description={<code className="text-xs">{menu.key}</code>}>
              {top.length === 0 ? (
                <p className="mb-4 text-sm text-muted">This menu has no links yet.</p>
              ) : (
                <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
                  {top.map((item, i) => {
                    const children = own.filter((c) => c.parent_id === item.id);
                    return (
                      <li key={item.id}>
                        <ItemRow item={item} parents={top} first={i === 0} last={i === top.length - 1} hasChildren={children.length > 0} />
                        {children.length > 0 && (
                          <ul className="border-t border-line bg-surface/60 pl-6">
                            {children.map((c, j) => (
                              <li key={c.id} className="border-b border-line last:border-b-0">
                                <ItemRow item={c} parents={top} first={j === 0} last={j === children.length - 1} hasChildren={false} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <details className="rounded-lg border border-dashed border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold text-brand">+ Add link</summary>
                <ActionForm action={createNavItem} resetOnSuccess className="mt-4">
                  <input type="hidden" name="menu_id" value={menu.id} />
                  <ItemFields idPrefix={`new-${menu.id}`} parents={top} />
                  <div className="mt-4">
                    <SubmitButton>Add</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function ItemRow({ item, parents, first, last, hasChildren }: { item: Item; parents: Item[]; first: boolean; last: boolean; hasChildren: boolean }) {
  const iconBtn = "inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30";
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${item.is_visible ? "text-ink" : "text-muted line-through"}`}>{item.label}</p>
          <p className="truncate text-xs text-muted">{item.href}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!item.is_visible && <Badge>Hidden</Badge>}
          {item.open_in_new_tab && <Badge tone="blue">New tab</Badge>}
          {hasChildren && <Badge tone="navy">Dropdown</Badge>}
        </div>
        <div className="flex items-center">
          {(["up", "down"] as const).map((dir) => (
            <ActionForm key={dir} action={moveNavItem}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="direction" value={dir} />
              <button type="submit" className={iconBtn} disabled={dir === "up" ? first : last} aria-label={`Move ${dir === "up" ? "up" : "down"}: ${item.label}`}>
                {dir === "up" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </button>
            </ActionForm>
          ))}
          <ActionForm action={toggleNavItem}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className={iconBtn} aria-label={`${item.is_visible ? "Hide" : "Show"}: ${item.label}`}>
              {item.is_visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </ActionForm>
          <ActionForm action={deleteNavItem} confirm={hasChildren ? `Remove "${item.label}" and all its sub-links?` : `Remove "${item.label}"?`}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className={`${iconBtn} hover:text-accent-700`} aria-label={`Remove: ${item.label}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </ActionForm>
        </div>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-brand">Edit</summary>
        <ActionForm action={updateNavItem} className="mt-3 rounded-lg border border-line bg-paper p-4">
          <input type="hidden" name="id" value={item.id} />
          <ItemFields idPrefix={item.id} parents={hasChildren ? [] : parents.filter((p) => p.id !== item.id)} item={item} />
          <div className="mt-4">
            <SubmitButton>Save</SubmitButton>
          </div>
        </ActionForm>
      </details>
    </div>
  );
}

function ItemFields({ idPrefix, parents, item }: { idPrefix: string; parents: Item[]; item?: Item }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Label" htmlFor={`${idPrefix}-label`}>
        <input id={`${idPrefix}-label`} name="label" required maxLength={60} defaultValue={item?.label} className="field" />
      </Field>
      <Field label="Label in English" htmlFor={`${idPrefix}-label-en`} hint="Shown when a reader switches the site to English. Leave empty to use the label above.">
        <input id={`${idPrefix}-label-en`} name="label_en" maxLength={60} defaultValue={item?.label_en ?? ""} className="field" />
      </Field>
      <Field label="Destination" htmlFor={`${idPrefix}-href`} hint="A path starting with / (e.g. /balita) or an https:// URL.">
        <input id={`${idPrefix}-href`} name="href" required maxLength={500} defaultValue={item?.href} className="field" placeholder="/balita" />
      </Field>
      <Field label="Parent (dropdown group)" htmlFor={`${idPrefix}-parent`} hint={item && parents.length === 0 ? "This has sub-links or there are no other top-level links, so it stays top-level." : undefined}>
        <select id={`${idPrefix}-parent`} name="parent_id" defaultValue={item?.parent_id ?? ""} className="field">
          <option value="">— Top-level —</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_visible" defaultChecked={item?.is_visible ?? true} className="h-4 w-4" /> Show on site
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="open_in_new_tab" defaultChecked={item?.open_in_new_tab ?? false} className="h-4 w-4" /> Open in new tab
        </label>
      </div>
    </div>
  );
}
