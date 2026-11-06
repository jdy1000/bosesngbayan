import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, Panel, StatusBadge } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/report-reasons";
import type { StaffContext } from "@/lib/auth/session";
import { moderate, resolveReport } from "./actions";
import { ACTION_LABELS, ACTION_TARGET, MODERATION_ACTIONS, REPORT_STATUS, activityLabel, type ModerationStatus } from "./labels";

/** Moderation decision form. Lists every action that changes the current state; the RPC is authoritative. */
export function ModerationPanel({
  targetType,
  targetId,
  status,
  isFeatured,
  currentNote,
}: {
  targetType: "community_post" | "comment";
  targetId: string;
  status: ModerationStatus;
  isFeatured?: boolean;
  currentNote: string | null;
}) {
  const actions = MODERATION_ACTIONS.filter((a) => {
    if (a === "feature") return targetType === "community_post" && status === "approved" && !isFeatured;
    if (a === "unfeature") return targetType === "community_post" && Boolean(isFeatured);
    return ACTION_TARGET[a] !== status;
  });
  return (
    <Panel title="Desisyon ng moderator">
      <ActionForm action={moderate} className="space-y-4">
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        {currentNote && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Kasalukuyang tala:</span> {currentNote}
          </p>
        )}
        <Field label="Bagong tala ng moderator" htmlFor="note" hint="Para sa staff lamang. Itinatala sa kasaysayan ng moderation.">
          <textarea id="note" name="note" rows={3} maxLength={2000} className="field py-2" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <SubmitButton
              key={a}
              name="action"
              value={a}
              pendingLabel="Sandali…"
              variant={a === "approve" ? "primary" : a === "remove" || a === "reject" ? "danger" : "outline"}
            >
              {ACTION_LABELS[a]}
            </SubmitButton>
          ))}
        </div>
      </ActionForm>
    </Panel>
  );
}

export interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function ReportsPanel({ reports }: { reports: ReportRow[] }) {
  return (
    <Panel title={`Mga ulat (${reports.length})`}>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">Walang ulat para dito.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}</strong>
                <StatusBadge status={r.status} map={REPORT_STATUS} />
                <span className="text-xs text-muted">{formatDateTime(r.created_at)}</span>
              </div>
              {r.details && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{r.details}</p>}
              {r.resolution_note && <p className="mt-1 text-xs text-muted">Tala: {r.resolution_note}</p>}
              <ActionForm action={resolveReport} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="report_id" value={r.id} />
                <label htmlFor={`rn-${r.id}`} className="sr-only">
                  Tala sa pagresolba
                </label>
                <input id={`rn-${r.id}`} name="note" maxLength={2000} placeholder="Tala (opsyonal)" className="field min-w-48 flex-1" />
                {r.status === "open" ? (
                  <>
                    <SubmitButton name="status" value="resolved" variant="outline">
                      Naresolba
                    </SubmitButton>
                    <SubmitButton name="status" value="dismissed" variant="ghost">
                      Ibasura
                    </SubmitButton>
                  </>
                ) : (
                  <SubmitButton name="status" value="open" variant="ghost">
                    Buksan muli
                  </SubmitButton>
                )}
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Moderation history from content_activity_logs for the item and its reports. */
export async function ActivityHistory({ ctx, entityType, entityId, reportIds }: { ctx: StaffContext; entityType: string; entityId: string; reportIds: string[] }) {
  const select = "id, action, from_status, to_status, note, created_at, actor:profiles(display_name)";
  const [own, reports] = await Promise.all([
    ctx.supabase.from("content_activity_logs").select(select).eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(50),
    reportIds.length
      ? ctx.supabase.from("content_activity_logs").select(select).eq("entity_type", "report").in("entity_id", reportIds).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (own.error || reports.error) {
    return (
      <Panel title="Kasaysayan ng moderation">
        <p className="text-sm text-accent-700">Hindi makuha ang kasaysayan.</p>
      </Panel>
    );
  }
  const rows = [...(own.data ?? []), ...(reports.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <Panel title="Kasaysayan ng moderation">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Wala pang aksyon ng moderator.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-line pb-2 last:border-0">
              <span className="font-semibold text-ink">{activityLabel(r.action)}</span>
              {r.from_status && r.to_status && r.from_status !== r.to_status && (
                <span className="text-ink-soft">
                  {" "}
                  ({r.from_status} → {r.to_status})
                </span>
              )}
              {r.note && <p className="text-ink-soft">“{r.note}”</p>}
              <div className="text-xs text-muted">
                {r.actor?.display_name ?? "Sistema"} · {formatDateTime(r.created_at)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
