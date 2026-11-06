import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Notice, Panel } from "@/components/studio/ui";
import { addOption, optionAction } from "../actions";

export function OptionsPanel({
  pollId,
  options,
  locked,
  canManage,
}: {
  pollId: string;
  options: { id: string; label: string }[];
  locked: boolean;
  canManage: boolean;
}) {
  return (
    <Panel title="Options" description={locked ? "You can still change the order." : "Edit, remove or reorder options."}>
      {locked && (
        <div className="mb-4">
          <Notice tone="warn">
            This poll already has votes, so the question, type, voting policy and options are locked to protect the integrity of
            the results. If they need to change, <strong>close it and create a new poll</strong>.
          </Notice>
        </div>
      )}
      {options.length === 0 ? (
        <p className="text-sm text-muted">No options yet.</p>
      ) : (
        <ol className="space-y-2">
          {options.map((o, i) => (
            <li key={o.id} className="rounded-lg border border-line p-3">
              {canManage ? (
                <ActionForm action={optionAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="poll_id" value={pollId} />
                  <input type="hidden" name="option_id" value={o.id} />
                  <span className="w-6 text-sm font-semibold text-muted">{i + 1}.</span>
                  <label htmlFor={`opt-${o.id}`} className="sr-only">
                    Option {i + 1}
                  </label>
                  <input
                    id={`opt-${o.id}`}
                    name="label"
                    defaultValue={o.label}
                    maxLength={200}
                    disabled={locked}
                    className="field min-w-48 flex-1 disabled:opacity-60"
                  />
                  {!locked && (
                    <SubmitButton name="op" value="save" variant="outline">
                      Save
                    </SubmitButton>
                  )}
                  <SubmitButton name="op" value="up" variant="ghost" pendingLabel="…">
                    <span aria-hidden="true">↑</span>
                    <span className="sr-only">Move up</span>
                  </SubmitButton>
                  <SubmitButton name="op" value="down" variant="ghost" pendingLabel="…">
                    <span aria-hidden="true">↓</span>
                    <span className="sr-only">Move down</span>
                  </SubmitButton>
                  {!locked && (
                    <SubmitButton name="op" value="remove" variant="ghost" pendingLabel="Removing…">
                      Remove
                    </SubmitButton>
                  )}
                </ActionForm>
              ) : (
                <span className="text-sm">
                  {i + 1}. {o.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {canManage && !locked && options.length < 20 && (
        <ActionForm action={addOption} resetOnSuccess className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="poll_id" value={pollId} />
          <label htmlFor="new-option" className="sr-only">
            New option
          </label>
          <input id="new-option" name="label" required maxLength={200} placeholder="New option…" className="field min-w-48 flex-1" />
          <SubmitButton variant="outline" pendingLabel="Adding…">
            Add
          </SubmitButton>
        </ActionForm>
      )}
    </Panel>
  );
}
