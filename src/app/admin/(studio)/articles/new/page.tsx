import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, PageHeader, Panel } from "@/components/studio/ui";
import { createArticle } from "../actions";

export const metadata: Metadata = { title: "Bagong artikulo" };

export default async function NewArticlePage() {
  const ctx = await requireStaffPage("articles.create");
  const { data: categories } = await ctx.supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order").order("name");

  return (
    <>
      <PageHeader title="Bagong artikulo" breadcrumb={[{ label: "Mga Artikulo", href: "/admin/articles" }]} description="Gagawa ito ng draft; ikaw ang may-akda. Maaari mong baguhin ang lahat sa editor." />
      <Panel className="max-w-2xl">
        <ActionForm action={createArticle} className="space-y-4">
          <Field label="Pamagat" htmlFor="title">
            <input id="title" name="title" className="field" required maxLength={300} autoFocus />
          </Field>
          <Field label="Kategorya (opsyonal)" htmlFor="category_id">
            <select id="category_id" name="category_id" className="field" defaultValue="">
              <option value="">— Pipiliin mamaya —</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton pendingLabel="Ginagawa…">Gumawa ng draft</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
