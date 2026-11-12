import { RANGE_LABELS, RANGE_PRESETS, type DateRange } from "@/lib/studio/range";
import { Notice } from "@/components/studio/ui";

/** Plain GET form: the range lives in the URL so it is shareable and works without JavaScript. */
export function RangeFilter({ action, range, today }: { action: string; range: DateRange; today: string }) {
  return (
    <div className="mb-6 space-y-3">
      <form method="get" action={action} className="flex flex-wrap items-end gap-3 rounded-[10px] border border-line bg-paper px-[22px] py-4 shadow-panel">
        <div>
          <label htmlFor="range" className="mb-[7px] block text-xs font-bold text-ink-soft">
            Range
          </label>
          <select id="range" name="range" defaultValue={range.preset} className="field min-h-10 py-1.5">
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {RANGE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-[7px] block text-xs font-bold text-ink-soft">
            From (custom)
          </label>
          <input id="from" name="from" type="date" max={today} defaultValue={range.fromDate} className="field min-h-10 py-1.5" />
        </div>
        <div>
          <label htmlFor="to" className="mb-[7px] block text-xs font-bold text-ink-soft">
            To (custom)
          </label>
          <input id="to" name="to" type="date" max={today} defaultValue={range.toDate} className="field min-h-10 py-1.5" />
        </div>
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
        <p className="w-full text-xs text-muted sm:ml-auto sm:w-auto">
          {range.label} · {range.fromDate} – {range.toDate} (Manila time)
        </p>
      </form>
      {range.error && <Notice tone="warn">{range.error} Showing the default range.</Notice>}
    </div>
  );
}

/** Ranked list with proportional bars; values come straight from stored rows. */
export function RankList({ rows, empty }: { rows: { key: string; label: React.ReactNode; value: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink">
              <span className="mr-2 tabular-nums text-muted">{i + 1}.</span>
              {r.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{r.value.toLocaleString("en-PH")}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
