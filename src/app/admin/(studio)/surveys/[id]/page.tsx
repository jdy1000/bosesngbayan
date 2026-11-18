import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media";
import { photoStyle } from "@/lib/survey-photo";
import { SURVEY_STATE, surveyState } from "@/lib/studio/surveys";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, PageHeader, Panel, RecordList, RecordMeta, RecordRow, RecordTitle } from "@/components/studio/ui";
import {
  addSurveyEntry,
  deleteSurveyEntry,
  moveSurveyEntry,
  sortSurveyEntriesByScore,
  updateSurvey,
  updateSurveyEntry,
} from "../actions";
import { EntryFields, SurveyFields, type EntryFormValues } from "../survey-fields";

export const metadata: Metadata = { title: "Edit survey" };

const SMALL = "!min-h-9 !px-3 !text-[13px]";
const UUID = /^[0-9a-f-]{36}$/i;
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

interface EntryRow {
  id: string;
  rank_no: number | null;
  name: string;
  area: string | null;
  overall_pct: number | null;
  trust_pct: number | null;
  performance_pct: number | null;
  photo_x: number;
  photo_y: number;
  photo_zoom: number;
  photo: { id: string; storage_path: string | null; external_url: string | null; alt_text: string | null; file_name: string } | null;
}

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("surveys.manage");
  if (!UUID.test(id)) notFound();

  const [surveyRes, entriesRes] = await Promise.all([
    ctx.supabase
      .from("surveys")
      .select("id, title, scope, subtitle, note, survey_date, is_published, show_on_homepage, sort_order")
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase
      .from("survey_entries")
      .select("id, rank_no, name, area, overall_pct, trust_pct, performance_pct, photo_x, photo_y, photo_zoom, photo:media_assets(id, storage_path, external_url, alt_text, file_name)")
      .eq("survey_id", id)
      .order("position")
      .order("created_at"),
  ]);
  if (surveyRes.error) throw surveyRes.error;
  if (entriesRes.error) throw entriesRes.error;
  const survey = surveyRes.data;
  if (!survey) notFound();
  const entries = (entriesRes.data ?? []) as unknown as EntryRow[];
  const state = SURVEY_STATE[surveyState(survey)];

  return (
    <>
      <PageHeader
        title={survey.title}
        breadcrumb={[{ label: "Surveys", href: "/admin/surveys" }]}
        description={
          <span className="inline-flex items-center gap-3">
            <Badge tone={state.tone}>{state.label}</Badge>
            <span>{entries.length === 1 ? "1 candidate" : `${entries.length} candidates`}</span>
          </span>
        }
      />

      <Panel title="Survey details" description="Heading, release date and visibility.">
        <ActionForm action={updateSurvey}>
          <input type="hidden" name="id" value={survey.id} />
          <SurveyFields idPrefix="survey" survey={survey} />
          <div className="mt-5">
            <SubmitButton>Save survey</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <div className="mt-6 grid items-start gap-6 min-[1101px]:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
        <Panel
          flush
          className="min-w-0"
          title="Candidates"
          description="Cards appear on the homepage in this order."
          actions={
            entries.length > 1 && (
              <ActionForm action={sortSurveyEntriesByScore}>
                <input type="hidden" name="survey_id" value={survey.id} />
                <SubmitButton variant="outline" pendingLabel="Sorting…" className={SMALL}>
                  Sort by overall score
                </SubmitButton>
              </ActionForm>
            )
          }
        >
          {entries.length === 0 ? (
            <Empty bare title="No candidates yet">Add the first candidate beside this list.</Empty>
          ) : (
            <RecordList label="Candidates">
              {entries.map((e, i) => (
                <EntryRecord key={e.id} surveyId={survey.id} e={e} first={i === 0} last={i === entries.length - 1} />
              ))}
            </RecordList>
          )}
        </Panel>

        <Panel title="Add candidate" description="Photo, rank and the three percentages." className="min-w-0">
          {/* key: after an add the form starts over, including the photo picker, which a plain form reset would not clear. */}
          <ActionForm key={entries.length} action={addSurveyEntry}>
            <input type="hidden" name="survey_id" value={survey.id} />
            <EntryFields idPrefix="new" />
            <div className="mt-5">
              <SubmitButton>Add candidate</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}

function EntryRecord({ surveyId, e, first, last }: { surveyId: string; e: EntryRow; first: boolean; last: boolean }) {
  const thumb = mediaUrl(e.photo);
  const values: EntryFormValues = {
    id: e.id,
    name: e.name,
    area: e.area,
    rank_no: e.rank_no,
    overall_pct: e.overall_pct,
    trust_pct: e.trust_pct,
    performance_pct: e.performance_pct,
    photo_x: e.photo_x,
    photo_y: e.photo_y,
    photo_zoom: e.photo_zoom,
    photo: e.photo ? { id: e.photo.id, url: thumb, alt_text: e.photo.alt_text, file_name: e.photo.file_name } : null,
  };
  return (
    <RecordRow>
      <div className="flex flex-col gap-x-7 gap-y-4 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {thumb ? (
            <span className="relative block size-16 shrink-0 overflow-hidden rounded-[5px] bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment */}
              <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" style={photoStyle({ x: e.photo_x, y: e.photo_y, zoom: e.photo_zoom })} loading="lazy" />
            </span>
          ) : (
            <span aria-hidden="true" className="grid h-16 w-14 shrink-0 place-items-center rounded-[5px] bg-surface-2 text-lg font-semibold text-muted">
              {e.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <RecordMeta>
              {e.rank_no !== null && <span className="font-bold text-accent-700">Rank {e.rank_no}</span>}
              {e.area && <span>{e.area}</span>}
            </RecordMeta>
            <RecordTitle>{e.name}</RecordTitle>
            <p className="text-[13px] text-ink-soft tabular-nums">
              Overall {pct(e.overall_pct)} · Trust {pct(e.trust_pct)} · Performance {pct(e.performance_pct)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          <ActionForm action={moveSurveyEntry} className="flex gap-1">
            <input type="hidden" name="survey_id" value={surveyId} />
            <input type="hidden" name="id" value={e.id} />
            <SubmitButton name="direction" value="up" variant="outline" pendingLabel="…" className={`${SMALL} ${first ? "invisible" : ""}`}>
              <span aria-hidden="true">↑</span>
              <span className="sr-only">Move {e.name} up</span>
            </SubmitButton>
            <SubmitButton name="direction" value="down" variant="outline" pendingLabel="…" className={`${SMALL} ${last ? "invisible" : ""}`}>
              <span aria-hidden="true">↓</span>
              <span className="sr-only">Move {e.name} down</span>
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteSurveyEntry} confirm={`Remove ${e.name} from this survey?`}>
            <input type="hidden" name="id" value={e.id} />
            <SubmitButton variant="danger" pendingLabel="Removing…" className={SMALL}>
              Remove
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-bold text-brand hover:underline">Edit candidate</summary>
        <div className="mt-3 rounded-[7px] border border-line bg-surface p-4">
          <ActionForm action={updateSurveyEntry}>
            <input type="hidden" name="id" value={e.id} />
            <EntryFields idPrefix={e.id} entry={values} />
            <div className="mt-5">
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>
    </RecordRow>
  );
}
