import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, Notice, Panel, RecordMeta, RecordTitle, StatusBadge } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/report-reasons";
import type { StaffContext } from "@/lib/auth/session";
import { moderate, resolveReport } from "./actions";
import { ACTION_LABELS, ACTION_TARGET, MODERATION_ACTIONS, REPORT_STATUS, REPORT_STATUSES, activityLabel, type ModerationStatus } from "./labels";

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
    <Panel title="Moderator decision">
      <ActionForm action={moderate} className="space-y-4">
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        {currentNote && (
          <p className="rounded-[7px] border border-line bg-surface px-3 py-2.5 text-[13px] leading-[1.5] text-ink-soft">
            <span className="font-bold text-ink">Current note:</span> {currentNote}
          </p>
        )}
        <Field label="New moderator note" htmlFor="note" hint="Staff only. Saved to the moderation history.">
          <textarea id="note" name="note" rows={3} maxLength={2000} className="field min-h-20" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <SubmitButton
              key={a}
              name="action"
              value={a}
              pendingLabel="Working…"
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

/** What the reader sent: status, dates, reason and the full message. Shared by the inbox and the item pages. */
export function ReportSummary({ report }: { report: ReportRow }) {
  return (
    <>
      <RecordMeta>
        <StatusBadge status={report.status} map={REPORT_STATUS} />
        <span>Received {formatDateTime(report.created_at)}</span>
        {report.resolved_at && <span>Closed {formatDateTime(report.resolved_at)}</span>}
      </RecordMeta>
      <RecordTitle>{REPORT_REASON_LABELS.en[report.reason as ReportReason] ?? report.reason}</RecordTitle>
      {report.details ? (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.55] text-ink-soft">{report.details}</p>
      ) : (
        <p className="text-[13px] text-muted">No details given.</p>
      )}
    </>
  );
}

/** Status + resolution note for one report. resolve_report() is authoritative and logs the change. */
export function ReportForm({ report, className = "" }: { report: Pick<ReportRow, "id" | "status" | "resolution_note">; className?: string }) {
  const label = "block text-xs font-bold text-ink-soft";
  return (
    <ActionForm action={resolveReport} className={`w-full space-y-3 ${className}`}>
      <input type="hidden" name="report_id" value={report.id} />
      <label className={label}>
        Status
        {/* key: React resets the form after the action and ignores a later defaultValue on a mounted select, so remount it when the saved status changes. */}
        <select key={report.status} name="status" defaultValue={report.status} className="field mt-[7px] font-normal">
          {REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REPORT_STATUS[s].label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Resolution note
        <textarea name="note" rows={3} maxLength={2000} defaultValue={report.resolution_note ?? ""} placeholder="Record action taken…" className="field mt-[7px] min-h-20 font-normal" />
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Updating…">Update report</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ReportsPanel({ reports }: { reports: ReportRow[] }) {
  return (
    <Panel title={`Reports (${reports.length})`}>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">No reports for this item.</p>
      ) : (
        <ul className="divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="py-5 first:pt-0 last:pb-0">
              <ReportSummary report={r} />
              <ReportForm report={r} className="mt-4 max-w-[520px]" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Label over value, for the Details panel of an item page. */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.35px] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children}</dd>
    </div>
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
      <Panel title="Moderation history">
        <Notice tone="error">Could not load the history.</Notice>
      </Panel>
    );
  }
  const rows = [...(own.data ?? []), ...(reports.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <Panel title="Moderation history">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No moderator actions yet.</p>
      ) : (
        <ol className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0">
              <span className="font-semibold text-ink">{activityLabel(r.action)}</span>
              {r.from_status && r.to_status && r.from_status !== r.to_status && (
                <span className="text-ink-soft">
                  {" "}
                  ({r.from_status} → {r.to_status})
                </span>
              )}
              {r.note && <p className="mt-1 leading-[1.55] text-ink-soft">“{r.note}”</p>}
              <div className="mt-1 text-xs text-muted">
                {r.actor?.display_name ?? "System"} · {formatDateTime(r.created_at)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
