"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { StatusBadge } from "@/components/studio/ui";
import { searchArticlesForRelated } from "../actions";

export function ContributorsPicker({
  people,
  initial,
  disabled,
  onChange,
}: {
  people: { id: string; display_name: string }[];
  initial: { profile_id: string; role_label: string }[];
  disabled: boolean;
  onChange: () => void;
}) {
  const [rows, setRows] = useState(initial);
  const used = new Set(rows.map((r) => r.profile_id));
  const available = people.filter((p) => !used.has(p.id));

  function update(next: typeof rows) {
    setRows(next);
    onChange();
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="contributors" value={JSON.stringify(rows)} />
      {rows.length === 0 && <p className="text-xs text-muted">No contributors.</p>}
      {rows.map((r, i) => (
        <div key={r.profile_id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{people.find((p) => p.id === r.profile_id)?.display_name ?? "Inactive user"}</span>
          <input
            className="field w-36"
            aria-label="Contributor role"
            value={r.role_label}
            maxLength={60}
            disabled={disabled}
            onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, role_label: e.target.value } : x)))}
          />
          {!disabled && (
            <button type="button" className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Remove contributor" onClick={() => update(rows.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {!disabled && available.length > 0 && (
        <select
          className="field"
          aria-label="Add contributor"
          value=""
          onChange={(e) => e.target.value && update([...rows, { profile_id: e.target.value, role_label: "Kontribyutor" }])}
        >
          <option value="">+ Add contributor…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

type Related = { id: string; title: string; status: string };

export function RelatedPicker({ articleId, initial, disabled, onChange }: { articleId: string; initial: Related[]; disabled: boolean; onChange: () => void }) {
  const [selected, setSelected] = useState(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Related[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchArticlesForRelated(q, articleId)
        .then((r) => !cancelled && (setResults(r), setFailed(false)))
        .catch(() => !cancelled && setFailed(true));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, articleId]);

  function update(next: Related[]) {
    setSelected(next);
    onChange();
  }

  const shown = q.trim() ? results.filter((r) => !selected.some((s) => s.id === r.id)) : [];

  return (
    <div>
      <input type="hidden" name="related_ids" value={JSON.stringify(selected.map((s) => s.id))} />
      <ol className="mb-2 space-y-1.5">
        {selected.length === 0 && <li className="text-xs text-muted">None selected; the site picks stories from the same category automatically.</li>}
        {selected.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
            <StatusBadge status={r.status} />
            {!disabled && (
              <button type="button" className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label={`Remove ${r.title}`} onClick={() => update(selected.filter((s) => s.id !== r.id))}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {!disabled && (
        <>
          <input
            type="search"
            className="field"
            placeholder="Search articles…"
            aria-label="Search related articles"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          />
          {failed && <p className="mt-1 text-xs text-accent-700">Search failed. Try again.</p>}
          {shown.length > 0 && (
            <ul className="mt-1 rounded-lg border border-line bg-paper py-1 text-sm">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface" onClick={() => (update([...selected, r]), setQ(""))}>
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <StatusBadge status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted">Only published articles appear on the public site.</p>
        </>
      )}
    </div>
  );
}
