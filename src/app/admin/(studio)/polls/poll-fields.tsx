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
  const lockHint = locked ? "Naka-lock: may mga boto na." : undefined;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <Field label="Tanong" htmlFor="question" hint={lockHint ?? "5–300 character."}>
          <input id="question" name="question" required minLength={5} maxLength={300} defaultValue={values?.question} disabled={locked} className="field disabled:opacity-60" />
        </Field>
        {/* Disabled inputs are not submitted; keep the value for schema validation. The server ignores it when locked. */}
        {locked && <input type="hidden" name="question" value={values?.question} />}
      </div>
      <Field label="Slug" htmlFor="slug" hint="Iwanang blangko para awtomatikong gawin mula sa tanong.">
        <input id="slug" name="slug" maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={values?.slug} className="field" />
      </Field>
      <Field label="Kategorya" htmlFor="category_id">
        <select id="category_id" name="category_id" defaultValue={values?.category_id ?? ""} className="field">
          <option value="">— Wala —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Paglalarawan" htmlFor="description" hint="Opsyonal, hanggang 1000 character.">
          <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={values?.description ?? ""} className="field py-2" />
        </Field>
      </div>
      <Field label="Uri" htmlFor="kind" hint={lockHint}>
        <select id="kind" name="kind" defaultValue={values?.kind ?? "single"} disabled={locked} className="field disabled:opacity-60">
          <option value="single">Isang sagot lamang</option>
          <option value="multiple">Maraming sagot</option>
        </select>
      </Field>
      <Field label="Max na sagot (para sa maraming sagot)" htmlFor="max_choices" hint={lockHint}>
        <input id="max_choices" name="max_choices" type="number" min={1} max={20} defaultValue={values?.max_choices ?? 2} disabled={locked} className="field disabled:opacity-60" />
      </Field>
      <Field label="Magbubukas (oras sa Maynila)" htmlFor="opens_at" hint="Blangko = bukas agad pagka-publish.">
        <input id="opens_at" name="opens_at" type="datetime-local" defaultValue={isoToManilaLocal(values?.opens_at)} className="field" />
      </Field>
      <Field label="Magsasara (oras sa Maynila)" htmlFor="closes_at" hint="Blangko = walang takdang pagsasara.">
        <input id="closes_at" name="closes_at" type="datetime-local" defaultValue={isoToManilaLocal(values?.closes_at)} className="field" />
      </Field>
      <Field label="Pagpapakita ng resulta" htmlFor="results_visibility">
        <select id="results_visibility" name="results_visibility" defaultValue={values?.results_visibility ?? "after_vote"} className="field">
          {Object.entries(RESULTS_VISIBILITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Patakaran sa pagboto" htmlFor="voting_policy" hint={lockHint ?? "Ang network check ay maaaring humarang sa mga gumagamit ng iisang Wi-Fi."}>
        <select id="voting_policy" name="voting_policy" defaultValue={values?.voting_policy ?? "one_per_browser"} disabled={locked} className="field disabled:opacity-60">
          {Object.entries(VOTING_POLICY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Metodolohiya / paalala" htmlFor="methodology_note" hint="Ipinapakita sa publiko. Ipaalala na ang boluntaryong online poll ay hindi kumakatawan sa buong populasyon ng Pilipinas.">
          <textarea id="methodology_note" name="methodology_note" rows={3} maxLength={2000} defaultValue={values?.methodology_note ?? ""} className="field py-2" />
        </Field>
      </div>
    </div>
  );
}
