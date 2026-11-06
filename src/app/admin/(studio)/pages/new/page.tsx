import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, PageHeader, Panel } from "@/components/studio/ui";
import { createPage } from "../actions";

export const metadata: Metadata = { title: "Bagong pahina" };

export default async function NewPagePage() {
  await requireStaffPage("pages.manage");
  return (
    <>
      <PageHeader
        title="Bagong pahina"
        breadcrumb={[{ label: "Mga Pahina", href: "/admin/pages" }]}
        description="Gagawa ito ng draft. Ang slug ay kukunin sa pamagat at mababago sa editor."
      />
      <Panel className="max-w-2xl">
        <ActionForm action={createPage} className="space-y-4">
          <Field label="Pamagat" htmlFor="title">
            <input id="title" name="title" className="field" required maxLength={200} autoFocus />
          </Field>
          <SubmitButton pendingLabel="Ginagawa…">Gumawa ng pahina</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
