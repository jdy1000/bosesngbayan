import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, PageHeader, Panel } from "@/components/studio/ui";
import { createPoll } from "../actions";
import { PollFields } from "../poll-fields";

export const metadata = { title: "Bagong poll" };

export default async function NewPollPage() {
  const ctx = await requireStaffPage("polls.manage");
  const { data: categories } = await ctx.supabase.from("categories").select("id, name").order("sort_order").order("name");

  return (
    <>
      <PageHeader
        title="Bagong poll"
        breadcrumb={[{ label: "Mga Botohan", href: "/admin/polls" }]}
        description="Mase-save ito bilang draft. I-publish kapag handa na."
      />
      <Panel>
        <ActionForm action={createPoll} className="space-y-6">
          <PollFields categories={categories ?? []} />
          <Field label="Mga pagpipilian" htmlFor="options" hint="Isa bawat linya, 2–20 pagpipilian, hanggang 200 character bawat isa.">
            <textarea id="options" name="options" rows={5} required className="field py-2" />
          </Field>
          <SubmitButton pendingLabel="Ginagawa…">Gumawa ng draft</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
