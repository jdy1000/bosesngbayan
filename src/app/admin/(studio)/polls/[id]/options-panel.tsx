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
    <Panel title="Mga pagpipilian" description={locked ? "Maaari pa ring baguhin ang pagkakasunod-sunod." : "I-edit, alisin o ayusin ang pagkakasunod-sunod."}>
      {locked && (
        <div className="mb-4">
          <Notice tone="warn">
            May mga boto na ang poll na ito kaya naka-lock ang tanong, uri, patakaran sa pagboto at mga pagpipilian para mapanatili ang
            integridad ng resulta. Kung kailangang baguhin, <strong>isara ito at gumawa ng bagong poll</strong>.
          </Notice>
        </div>
      )}
      {options.length === 0 ? (
        <p className="text-sm text-muted">Wala pang pagpipilian.</p>
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
                    Pagpipilian {i + 1}
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
                      I-save
                    </SubmitButton>
                  )}
                  <SubmitButton name="op" value="up" variant="ghost" pendingLabel="…">
                    <span aria-hidden="true">↑</span>
                    <span className="sr-only">Itaas</span>
                  </SubmitButton>
                  <SubmitButton name="op" value="down" variant="ghost" pendingLabel="…">
                    <span aria-hidden="true">↓</span>
                    <span className="sr-only">Ibaba</span>
                  </SubmitButton>
                  {!locked && (
                    <SubmitButton name="op" value="remove" variant="ghost" pendingLabel="Inaalis…">
                      Alisin
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
            Bagong pagpipilian
          </label>
          <input id="new-option" name="label" required maxLength={200} placeholder="Bagong pagpipilian…" className="field min-w-48 flex-1" />
          <SubmitButton variant="outline" pendingLabel="Idinadagdag…">
            Idagdag
          </SubmitButton>
        </ActionForm>
      )}
    </Panel>
  );
}
