import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, PageHeader, Panel } from "@/components/studio/ui";
import { createPage } from "../actions";

export const metadata: Metadata = { title: "New page" };

export default async function NewPagePage() {
  await requireStaffPage("pages.manage");
  return (
    <>
      <PageHeader
        title="New page"
        breadcrumb={[{ label: "Pages", href: "/admin/pages" }]}
        description="This creates a draft. The slug is taken from the title and can be changed in the editor."
      />
      <Panel className="max-w-2xl">
        <ActionForm action={createPage} className="space-y-4">
          <Field label="Title" htmlFor="title">
            <input id="title" name="title" className="field" required maxLength={200} autoFocus />
          </Field>
          <SubmitButton pendingLabel="Creating…">Create page</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
