import { Field } from "@/components/studio/ui";
import { isoToManilaLocal } from "@/lib/format";
import { RESULTS_VISIBILITY_LABELS, VOTING_POLICY_LABELS } from "./labels";

export interface PollFieldValues {
  question: string;
  slug: string;
  description: string | null;
  kind: "single" | "multiple";
  max_choices: number;
  opens_at: string | null;
  closes_at: string | null;
  results_visibility: keyof typeof RESULTS_VISIBILITY_LABELS;
  voting_policy: keyof typeof VOTING_POLICY_LABELS;
  methodology_note: string | null;
  category_id: string | null;
}

/** Shared poll fields for create/edit. `locked` disables the fields polls_guard freezes after votes. */
export function PollFields({
  values,
  categories,
  locked = false,
}: {
  values?: PollFieldValues;
  categories: { id: string; name: string }[];
  locked?: boolean;
}) {
  const lockHint = locked ? "Locked: this poll already has votes." : undefined;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <Field label="Question" htmlFor="question" hint={lockHint ?? "5–300 characters."}>
          <input id="question" name="question" required minLength={5} maxLength={300} defaultValue={values?.question} disabled={locked} className="field disabled:opacity-60" />
        </Field>
        {/* Disabled inputs are not submitted; keep the value for schema validation. The server ignores it when locked. */}
        {locked && <input type="hidden" name="question" value={values?.question} />}
      </div>
      <Field label="Slug" htmlFor="slug" hint="Leave blank to generate it from the question.">
        <input id="slug" name="slug" maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={values?.slug} className="field" />
      </Field>
      <Field label="Category" htmlFor="category_id">
        <select id="category_id" name="category_id" defaultValue={values?.category_id ?? ""} className="field">
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Description" htmlFor="description" hint="Optional, up to 1000 characters.">
          <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={values?.description ?? ""} className="field py-2" />
        </Field>
      </div>
      <Field label="Type" htmlFor="kind" hint={lockHint}>
        <select id="kind" name="kind" defaultValue={values?.kind ?? "single"} disabled={locked} className="field disabled:opacity-60">
          <option value="single">Single choice</option>
          <option value="multiple">Multiple choice</option>
        </select>
      </Field>
      <Field label="Max choices (multiple choice only)" htmlFor="max_choices" hint={lockHint}>
        <input id="max_choices" name="max_choices" type="number" min={1} max={20} defaultValue={values?.max_choices ?? 2} disabled={locked} className="field disabled:opacity-60" />
      </Field>
      <Field label="Opens (Manila time)" htmlFor="opens_at" hint="Blank = opens as soon as it is published.">
        <input id="opens_at" name="opens_at" type="datetime-local" defaultValue={isoToManilaLocal(values?.opens_at)} className="field" />
      </Field>
      <Field label="Closes (Manila time)" htmlFor="closes_at" hint="Blank = no scheduled close.">
        <input id="closes_at" name="closes_at" type="datetime-local" defaultValue={isoToManilaLocal(values?.closes_at)} className="field" />
      </Field>
      <Field label="Results visibility" htmlFor="results_visibility">
        <select id="results_visibility" name="results_visibility" defaultValue={values?.results_visibility ?? "after_vote"} className="field">
          {Object.entries(RESULTS_VISIBILITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Voting policy" htmlFor="voting_policy" hint={lockHint ?? "The network check can block people who share the same Wi-Fi."}>
        <select id="voting_policy" name="voting_policy" defaultValue={values?.voting_policy ?? "one_per_browser"} disabled={locked} className="field disabled:opacity-60">
          {Object.entries(VOTING_POLICY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Methodology / caveat" htmlFor="methodology_note" hint="Shown to the public. Note that a voluntary online poll does not represent the whole Philippine population.">
          <textarea id="methodology_note" name="methodology_note" rows={3} maxLength={2000} defaultValue={values?.methodology_note ?? ""} className="field py-2" />
        </Field>
      </div>
    </div>
  );
}
