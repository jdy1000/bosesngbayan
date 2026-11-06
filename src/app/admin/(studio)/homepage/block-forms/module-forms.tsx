"use client";

import type { BlockFormProps } from "../types";
import { LinkField, MediaField, TextField } from "./fields";

export function PhotoOfDayForm({ value, onChange, options }: BlockFormProps<"photo_of_day">) {
  return (
    <div className="space-y-4">
      <MediaField label="Image" value={value.media_id} onChange={(v) => onChange({ ...value, media_id: v })} options={options} />
      <TextField
        label="Caption"
        multiline
        value={value.caption}
        onChange={(v) => onChange({ ...value, caption: v })}
        max={400}
        hint="If blank, the media's caption and credit are used."
      />
      <LinkField label="Link" value={value.link} onChange={(v) => onChange({ ...value, link: v })} />
    </div>
  );
}

export function QuoteOfDayForm({ value, onChange }: BlockFormProps<"quote_of_day">) {
  return (
    <div className="space-y-4">
      <TextField label="Quote" required multiline value={value.quote} onChange={(v) => onChange({ ...value, quote: v })} max={500} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Said by" required value={value.attribution} onChange={(v) => onChange({ ...value, attribution: v })} max={160} />
        <TextField label="Context" value={value.context} onChange={(v) => onChange({ ...value, context: v })} max={240} />
      </div>
      <TextField
        label="Source URL"
        value={value.source_url}
        onChange={(v) => onChange({ ...value, source_url: v })}
        max={500}
        hint="An https:// source so the quote can be verified."
      />
    </div>
  );
}

type Question = BlockFormProps<"news_quiz">["value"]["questions"][number];
const blankQuestion = (): Question => ({ question: "", options: ["", ""], correct_index: 0, explanation: "", article_slug: "" });

export function NewsQuizForm({ value, onChange }: BlockFormProps<"news_quiz">) {
  const setQ = (i: number, patch: Partial<Question>) =>
    onChange({ ...value, questions: value.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  return (
    <div className="space-y-4">
      <TextField label="Intro" multiline value={value.intro} onChange={(v) => onChange({ ...value, intro: v })} max={300} />
      {value.questions.length === 0 && <p className="text-sm text-amber-700">The quiz needs at least one question before it can be enabled.</p>}
      {value.questions.map((q, i) => (
        <fieldset key={i} className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">Question {i + 1}</legend>
          <TextField label="Question" required value={q.question} onChange={(v) => setQ(i, { question: v })} max={300} />
          <div className="space-y-2">
            {q.options.map((opt, k) => (
              <div key={k} className="flex items-end gap-2">
                <label className="flex min-h-10 items-center gap-1.5 text-xs font-semibold text-ink">
                  <input type="radio" name={`correct-${i}`} checked={q.correct_index === k} onChange={() => setQ(i, { correct_index: k })} />
                  Correct
                </label>
                <div className="flex-1">
                  <TextField
                    label={`Option ${k + 1}`}
                    value={opt}
                    onChange={(v) => setQ(i, { options: q.options.map((o, m) => (m === k ? v : o)) })}
                    max={160}
                  />
                </div>
                {q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setQ(i, {
                        options: q.options.filter((_, m) => m !== k),
                        correct_index: q.correct_index === k ? 0 : q.correct_index > k ? q.correct_index - 1 : q.correct_index,
                      })
                    }
                    className="btn min-h-10 px-3 text-sm text-accent-700 hover:bg-surface-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {q.options.length < 5 && (
              <button type="button" onClick={() => setQ(i, { options: [...q.options, ""] })} className="btn btn-outline min-h-9 px-3 text-sm">
                + Option
              </button>
            )}
          </div>
          <TextField label="Explanation" multiline value={q.explanation} onChange={(v) => setQ(i, { explanation: v })} max={500} />
          <TextField label="Related article slug" value={q.article_slug} onChange={(v) => setQ(i, { article_slug: v })} max={160} />
          <button
            type="button"
            onClick={() => onChange({ ...value, questions: value.questions.filter((_, j) => j !== i) })}
            className="text-sm font-semibold text-accent-700 hover:underline"
          >
            Remove question
          </button>
        </fieldset>
      ))}
      {value.questions.length < 10 && (
        <button type="button" onClick={() => onChange({ ...value, questions: [...value.questions, blankQuestion()] })} className="btn btn-outline min-h-9 px-3 text-sm">
          + Add question
        </button>
      )}
    </div>
  );
}

