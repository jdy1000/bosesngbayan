import { Panel } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import type { StaffContext } from "@/lib/auth/session";

const ACTION_LABELS: Record<string, string> = { insert: "Ginawa", update: "Binago", delete: "Binura" };
const IGNORED = new Set(["updated_at", "updated_by"]);

type Json = Record<string, unknown> | null;

function changedFields(details: unknown): string[] {
  const d = (details ?? {}) as { old?: Json; new?: Json };
  if (!d.old || !d.new) return [];
  return Object.keys(d.new).filter((k) => !IGNORED.has(k) && JSON.stringify(d.new?.[k]) !== JSON.stringify(d.old?.[k]));
}

/** Audit trail for a poll and its options (audit_logs rows written by audit_row_change triggers). */
export async function PollHistory({ ctx, pollId }: { ctx: StaffContext; pollId: string }) {
  const select = "id, action, entity_type, details, created_at, actor:profiles(display_name)";
  const [pollRows, optionRows] = await Promise.all([
    ctx.supabase.from("audit_logs").select(select).eq("entity_type", "polls").eq("entity_id", pollId).order("created_at", { ascending: false }).limit(50),
    ctx.supabase
      .from("audit_logs")
      .select(select)
      .eq("entity_type", "poll_options")
      .or(`details->new->>poll_id.eq.${pollId},details->old->>poll_id.eq.${pollId}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (pollRows.error || optionRows.error) {
    return (
      <Panel title="Kasaysayan (audit log)">
        <p className="text-sm text-accent-700">Hindi makuha ang audit log.</p>
      </Panel>
    );
  }
  const rows = [...(pollRows.data ?? []), ...(optionRows.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);

  return (
    <Panel title="Kasaysayan (audit log)" description="Mga pagbabago sa poll at sa mga pagpipilian nito.">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Wala pang naitalang pagbabago.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {rows.map((r) => {
            const fields = changedFields(r.details);
            const target = r.entity_type === "poll_options" ? "pagpipilian" : "poll";
            return (
              <li key={r.id} className="border-b border-line pb-2 last:border-0">
                <span className="font-semibold text-ink">{ACTION_LABELS[r.action] ?? r.action}</span> ang {target}
                {fields.length > 0 && <span className="text-ink-soft"> ({fields.join(", ")})</span>}
                <div className="text-xs text-muted">
                  {r.actor?.display_name ?? "Sistema"} · {formatDateTime(r.created_at)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
