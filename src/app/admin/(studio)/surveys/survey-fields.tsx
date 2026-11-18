import { Field } from "@/components/studio/ui";
import type { PickedMedia } from "@/components/studio/media-picker";
import { PHOTO_DEFAULTS } from "@/lib/survey-photo";
import { EntryPhotoField } from "./entry-photo-field";

export interface SurveyFormValues {
  id: string;
  title: string;
  scope: string | null;
  subtitle: string | null;
  note: string | null;
  survey_date: string;
  is_published: boolean;
  show_on_homepage: boolean;
  sort_order: number;
}

export interface EntryFormValues {
  id: string;
  name: string;
  area: string | null;
  rank_no: number | null;
  overall_pct: number | null;
  trust_pct: number | null;
  performance_pct: number | null;
  photo: PickedMedia | null;
  photo_x: number;
  photo_y: number;
  photo_zoom: number;
}

/** Today in Manila as yyyy-mm-dd, the default release date of a new survey. */
const todayManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** One column in the narrow create panel, two when the form has room (container query). */
export function SurveyFields({ idPrefix, survey }: { idPrefix: string; survey?: SurveyFormValues }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @lg:grid-cols-2">
        <div className="@lg:col-span-2">
          <Field label="Title" htmlFor={`${idPrefix}-title`} hint="e.g. Top-performing, most trusted vice mayors">
            <input id={`${idPrefix}-title`} name="title" required maxLength={160} defaultValue={survey?.title} className="field" />
          </Field>
        </div>
        <Field label="Area (optional)" htmlFor={`${idPrefix}-scope`} hint="Shown after the title, e.g. National Capital Region.">
          <input id={`${idPrefix}-scope`} name="scope" maxLength={120} defaultValue={survey?.scope ?? ""} className="field" />
        </Field>
        <Field label="Release date" htmlFor={`${idPrefix}-date`} hint="The day the ratings were released.">
          <input id={`${idPrefix}-date`} name="survey_date" type="date" required defaultValue={survey?.survey_date ?? todayManila()} className="field" />
        </Field>
        <div className="@lg:col-span-2">
          <Field label="Subtitle (optional)" htmlFor={`${idPrefix}-subtitle`} hint="What is rated, e.g. “Boses ng Bayan” Index of Governance (IOG) – Trust & Performance Ratings.">
            <input id={`${idPrefix}-subtitle`} name="subtitle" maxLength={240} defaultValue={survey?.subtitle ?? ""} className="field" />
          </Field>
        </div>
        <div className="@lg:col-span-2">
          <Field label="Small print (optional)" htmlFor={`${idPrefix}-note`} hint="Method, sample, sponsor — only what you can stand behind. Shown under the cards.">
            <textarea id={`${idPrefix}-note`} name="note" maxLength={500} rows={3} defaultValue={survey?.note ?? ""} className="field" />
          </Field>
        </div>
        <Field label="Order" htmlFor={`${idPrefix}-order`} hint="Lower shows first when several surveys are on the homepage.">
          <input id={`${idPrefix}-order`} name="sort_order" type="number" min={-1000} max={1000} step={1} defaultValue={survey?.sort_order ?? 0} className="field" />
        </Field>
        <fieldset className="grid content-start gap-2.5">
          <legend className="mb-2 text-sm font-semibold text-ink">Visibility</legend>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="is_published" defaultChecked={survey?.is_published ?? false} className="h-4 w-4" /> Published
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="show_on_homepage" defaultChecked={survey?.show_on_homepage ?? true} className="h-4 w-4" /> Show on the homepage
          </label>
        </fieldset>
      </div>
    </div>
  );
}

/** Candidate card fields; one column in a narrow panel, three for the percentages when there is room. */
export function EntryFields({ idPrefix, entry }: { idPrefix: string; entry?: EntryFormValues }) {
  const pct = (name: string, label: string, value: number | null | undefined, hint?: string) => (
    <Field label={label} htmlFor={`${idPrefix}-${name}`} hint={hint}>
      <input id={`${idPrefix}-${name}`} name={name} type="number" inputMode="decimal" min={0} max={100} step={0.1} defaultValue={value ?? ""} className="field" />
    </Field>
  );
  return (
    <div className="@container">
      <div className="grid gap-4 @lg:grid-cols-2">
        <Field label="Name" htmlFor={`${idPrefix}-name`} hint="As it should read on the card, e.g. Kid Peña.">
          <input id={`${idPrefix}-name`} name="name" required maxLength={120} defaultValue={entry?.name} className="field" />
        </Field>
        <Field label="City / office (optional)" htmlFor={`${idPrefix}-area`} hint="e.g. Makati City.">
          <input id={`${idPrefix}-area`} name="area" maxLength={120} defaultValue={entry?.area ?? ""} className="field" />
        </Field>
        <Field label="Rank (optional)" htmlFor={`${idPrefix}-rank_no`} hint="Shown as the red tile. Ties can share a number.">
          <input id={`${idPrefix}-rank_no`} name="rank_no" type="number" min={1} max={999} step={1} defaultValue={entry?.rank_no ?? ""} className="field" />
        </Field>
        <div className="grid grid-cols-3 gap-3 @lg:col-span-2">
          {pct("overall_pct", "Overall %", entry?.overall_pct, "0–100")}
          {pct("trust_pct", "Trust %", entry?.trust_pct)}
          {pct("performance_pct", "Performance %", entry?.performance_pct)}
        </div>
        <div className="@lg:col-span-2">
          <EntryPhotoField
            photo={entry?.photo ?? null}
            x={entry?.photo_x ?? PHOTO_DEFAULTS.x}
            y={entry?.photo_y ?? PHOTO_DEFAULTS.y}
            zoom={entry?.photo_zoom ?? PHOTO_DEFAULTS.zoom}
          />
        </div>
      </div>
    </div>
  );
}
