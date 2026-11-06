import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, PageHeader, Panel } from "@/components/studio/ui";
import { createArticle } from "../actions";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticlePage() {
  const ctx = await requireStaffPage("articles.create");
  const { data: categories } = await ctx.supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order").order("name");

  return (
    <>
      <PageHeader title="New article" breadcrumb={[{ label: "Articles", href: "/admin/articles" }]} description="This creates a draft with you as the author. You can change everything in the editor." />
      <Panel className="max-w-2xl">
        <ActionForm action={createArticle} className="space-y-4">
          <Field label="Title" htmlFor="title">
            <input id="title" name="title" className="field" required maxLength={300} autoFocus />
          </Field>
          <Field label="Category (optional)" htmlFor="category_id">
            <select id="category_id" name="category_id" className="field" defaultValue="">
              <option value="">— Choose later —</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
