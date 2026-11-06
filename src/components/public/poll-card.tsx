"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check } from "lucide-react";

export interface PollCardPoll {
  id: string;
  slug: string;
  question: string;
  kind: "single" | "multiple";
  max_choices: number;
  results_visibility: "always" | "after_vote" | "after_close" | "hidden";
  closes_at: string | null;
  options: { id: string; label: string }[];
}

export interface PollCardResults {
  visible: boolean;
  has_voted: boolean;
  is_open: boolean;
  total_ballots?: number;
  options?: { option_id: string; votes: number }[];
}

const HIDDEN_NOTE: Record<PollCardPoll["results_visibility"], string> = {
  always: "",
  after_vote: "Makikita ang resulta pagkatapos bumoto.",
  after_close: "Ilalabas ang resulta kapag sarado na ang botohan.",
  hidden: "Hindi ipinapakita sa publiko ang resulta ng poll na ito.",
};

function pct(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

export function PollCard({
  poll,
  initialResults,
  variant = "full",
  closesLabel,
}: {
  poll: PollCardPoll;
  initialResults: PollCardResults;
  variant?: "hero" | "full";
  closesLabel?: string | null;
}) {
  const id = useId();
  const [results, setResults] = useState(initialResults);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const multiple = poll.kind === "multiple";
  const canVote = results.is_open && !results.has_voted;
  const showResults = results.visible && results.options !== undefined;
  const total = results.total_ballots ?? 0;
  const votesFor = (optionId: string) => results.options?.find((o) => o.option_id === optionId)?.votes ?? 0;

  function toggle(optionId: string) {
    setMessage(null);
    if (!multiple) return setSelected([optionId]);
    setSelected((cur) => {
      if (cur.includes(optionId)) return cur.filter((x) => x !== optionId);
      if (cur.length >= poll.max_choices) return cur;
      return [...cur, optionId];
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length === 0) {
      setMessage({ tone: "error", text: "Pumili muna ng sagot." });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/v1/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionIds: selected, website: String(new FormData(event.currentTarget).get("website") ?? "") }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string; results?: PollCardResults } | null;
      if (body?.results) setResults(body.results);
      if (res.ok) setMessage({ tone: "ok", text: body?.message ?? "Salamat! Naitala ang iyong boto." });
      else setMessage({ tone: "error", text: body?.error ?? body?.message ?? "Hindi naitala ang boto." });
    } catch {
      setMessage({ tone: "error", text: "Walang koneksyon. Subukang muli." });
    } finally {
      setPending(false);
    }
  }

  const hero = variant === "hero";

  return (
    <div className={`card ${hero ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-brand">
          <span className={`h-2 w-2 rounded-full ${results.is_open ? "bg-accent" : "bg-muted"}`} aria-hidden="true" />
          {results.is_open ? "Bukas ang botohan" : "Sarado na"}
        </span>
        {closesLabel && <span className="text-xs text-muted">{closesLabel}</span>}
      </div>
      <h3 id={`${id}-q`} className={`font-semibold leading-snug text-ink ${hero ? "text-xl" : "text-2xl md:text-[1.75rem]"}`}>
        {poll.question}
      </h3>
      {multiple && canVote && <p className="mt-1 text-sm text-muted">Pumili ng hanggang {poll.max_choices}.</p>}

      {canVote ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-2.5" aria-labelledby={`${id}-q`}>
          <fieldset className="space-y-2.5">
            <legend className="sr-only">{poll.question}</legend>
            {poll.options.map((o) => {
              const checked = selected.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-[0.95rem] font-medium transition-[box-shadow,background-color] duration-150 ${
                    checked ? "bg-brand-50 text-ink shadow-[inset_0_0_0_2px_var(--color-brand)]" : "bg-white shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-brand-200)]"
                  }`}
                >
                  <input
                    type={multiple ? "checkbox" : "radio"}
                    name={`${id}-option`}
                    value={o.id}
                    checked={checked}
                    onChange={() => toggle(o.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${multiple ? "rounded-md" : "rounded-full"} ${
                      checked ? "border-brand bg-brand text-white" : "border-line bg-white"
                    } peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand`}
                  >
                    {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span>{o.label}</span>
                </label>
              );
            })}
          </fieldset>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <button type="submit" className="btn btn-primary mt-2 w-full" disabled={pending}>
            {pending ? "Ipinapadala…" : "Bumoto"}
          </button>
        </form>
      ) : (
        <div className="mt-5 space-y-3">
          {showResults ? (
            poll.options.map((o) => {
              const p = pct(votesFor(o.id), total);
              return (
                <div key={o.id}>
                  <div className="mb-1 flex justify-between gap-3 text-[0.95rem]">
                    <span className="font-medium text-ink">{o.label}</span>
                    <span className="font-bold tabular-nums text-ink">{p}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                    <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">
              {results.has_voted ? "Salamat sa iyong boto. " : ""}
              {HIDDEN_NOTE[poll.results_visibility] || "Hindi pa available ang resulta."}
            </p>
          )}
        </div>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-3 text-sm font-medium ${message.tone === "error" ? "text-accent" : "text-brand-700"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
        <span className="text-muted">
          {showResults ? `${total.toLocaleString("en-PH")} ${total === 1 ? "boto" : "mga boto"}` : results.has_voted ? "Nakaboto ka na" : ""}
        </span>
        <Link href={`/botohan/${poll.slug}`} className="font-bold text-brand hover:underline">
          {hero ? "Tingnan ang detalye" : "Paano binibilang ang boto?"}
        </Link>
      </div>
    </div>
  );
}
