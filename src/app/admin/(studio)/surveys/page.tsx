import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { SURVEY_STATE, surveyState } from "@/lib/studio/surveys";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, PageHeader, Panel, RecordList, RecordMeta, RecordRow, RecordTitle } from "@/components/studio/ui";
import { createSurvey, deleteSurvey, toggleSurveyPublished } from "./actions";
import { SurveyFields } from "./survey-fields";

export const metadata: Metadata = { title: "Surveys" };

/** Row buttons: SubmitButton sets its own size, so the smaller one needs `!`. */
const SMALL = "!min-h-9 !px-3 !text-[13px]";
const MAX_ROWS = 100;

interface SurveyRow {
  id: string;
  title: string;
  scope: string | null;
  survey_date: string;
  is_published: boolean;
  show_on_homepage: boolean;
  updated_at: string;
  entries: { count: number }[];
}

/**
 * Surveys admin: every survey with its state and candidate count on the left, the create form on the right.
 * Opening a survey (/admin/surveys/[id]) edits its details and its candidates. The public homepage shows the
 * published surveys that are switched on for it as a moving row of cards under the lead story.
 */
export default async function SurveysPage() {
  const ctx = await requireStaffPage("surveys.manage");
  const { data, error } = await ctx.supabase
    .from("surveys")
    .select("id, title, scope, survey_date, is_published, show_on_homepage, updated_at, entries:survey_entries(count)")
    .order("sort_order")
    .order("survey_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) throw error;
  const rows = (data ?? []) as unknown as SurveyRow[];

  return (
    <>
      <PageHeader
        eyebrow="Homepage"
        title="Surveys"
        description="Publish survey results as a moving row of candidate cards under the homepage's lead story."
      />

      <div className="grid items-start gap-6 min-[1101px]:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
        <Panel flush className="min-w-0">
          {rows.length === 0 ? (
            <Empty bare title="No surveys yet">Create the first survey beside this list, then add its candidates.</Empty>
          ) : (
            <RecordList label="Surveys">
              {rows.map((s) => {
                const state = SURVEY_STATE[surveyState(s)];
                const count = s.entries[0]?.count ?? 0;
                return (
                  <RecordRow key={s.id}>
                    <RecordMeta>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      <span className="tabular-nums">{formatDate(s.survey_date)}</span>
                      <span className="tabular-nums">
                        {count} {count === 1 ? "candidate" : "candidates"}
                      </span>
                    </RecordMeta>
                    <RecordTitle>
                      {s.title}
                      {s.scope && <span className="font-normal text-muted"> ({s.scope})</span>}
                    </RecordTitle>
                    <p className="text-xs text-muted">Updated {formatDateTime(s.updated_at)}</p>
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <Link href={`/admin/surveys/${s.id}`} className="btn btn-primary min-h-9 px-3 text-[13px]">
                        Edit survey &amp; candidates
                      </Link>
                      <ActionForm action={toggleSurveyPublished}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="publish" value={String(!s.is_published)} />
                        <SubmitButton variant="outline" pendingLabel="Updating…" className={SMALL}>
                          {s.is_published ? "Unpublish" : "Publish"}
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteSurvey} confirm={`Delete the survey “${s.title}” and all its candidates? This can't be undone.`}>
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton variant="danger" pendingLabel="Deleting…" className={SMALL}>
                          Delete
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </RecordRow>
                );
              })}
            </RecordList>
          )}
        </Panel>

        <Panel title="New survey" description="Saved as a draft until you publish it." className="min-w-0">
          <ActionForm action={createSurvey}>
            <SurveyFields idPrefix="new" />
            <div className="mt-5">
              <SubmitButton>Create survey</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <p className="mt-[18px] text-[13px] leading-[1.55] text-muted">
        A survey shows on the homepage when it is <strong>published</strong> and <strong>shown on the homepage</strong>. With more than one, readers get tabs to
        switch between them; the lowest order number comes first, then the newest date.
      </p>
    </>
  );
}
