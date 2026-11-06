import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, PageHeader, Panel } from "@/components/studio/ui";
import { createPoll } from "../actions";
import { PollFields } from "../poll-fields";

export const metadata = { title: "New poll" };

export default async function NewPollPage() {
  const ctx = await requireStaffPage("polls.manage");
  const { data: categories } = await ctx.supabase.from("categories").select("id, name").order("sort_order").order("name");

  return (
    <>
      <PageHeader
        title="New poll"
        breadcrumb={[{ label: "Polls", href: "/admin/polls" }]}
        description="This is saved as a draft. Publish it when it is ready."
      />
      <Panel>
        <ActionForm action={createPoll} className="space-y-6">
          <PollFields categories={categories ?? []} />
          <Field label="Options" htmlFor="options" hint="One per line, 2–20 options, up to 200 characters each.">
            <textarea id="options" name="options" rows={5} required className="field py-2" />
          </Field>
          <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
