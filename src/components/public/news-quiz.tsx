"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/public/i18n-provider";
import { fmt } from "@/lib/i18n/config";

interface Question {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  article_slug: string;
}

/** Self-scored quiz. Answers are not submitted or stored anywhere. */
export function NewsQuiz({ questions }: { questions: Question[] }) {
  const { t } = useI18n();
  const m = t.blocks.quiz;
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const answered = answers.filter((a) => a !== null).length;
  const score = answers.filter((a, i) => a === questions[i]?.correct_index).length;

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const picked = answers[qi];
        const done = picked !== null && picked !== undefined;
        return (
          <fieldset key={qi} className="card p-6">
            <legend className="sr-only">{fmt(m.question, { n: qi + 1 })}</legend>
            <p className="text-xs font-bold uppercase tracking-wider text-brand">{fmt(m.question, { n: qi + 1 })}</p>
            <p className="mt-1 text-xl font-semibold text-ink">{q.question}</p>
            <div className="mt-4 grid gap-2">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.correct_index;
                const state = !done ? "" : isCorrect ? "bg-emerald-50 shadow-[inset_0_0_0_2px_#059669]" : picked === oi ? "bg-red-50 shadow-[inset_0_0_0_2px_var(--color-accent)]" : "opacity-60";
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={done}
                    onClick={() => setAnswers((cur) => cur.map((a, i) => (i === qi ? oi : a)))}
                    className={`min-h-12 rounded-xl px-4 py-2.5 text-left text-[0.95rem] font-medium shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors enabled:hover:bg-brand-50 ${state}`}
                  >
                    {opt}
                    {done && isCorrect && <span className="sr-only">{m.correctAnswer}</span>}
                  </button>
                );
              })}
            </div>
            {done && (
              <div role="status" className="mt-4 text-[0.95rem] text-ink-soft">
                <strong className={picked === q.correct_index ? "text-emerald-700" : "text-accent"}>
                  {picked === q.correct_index ? m.correct : m.wrong}
                </strong>{" "}
                {q.explanation}
                {q.article_slug && (
                  <>
                    {" "}
                    <Link href={`/balita/${q.article_slug}`} className="font-semibold text-brand hover:underline">
                      {m.readStory}
                    </Link>
                  </>
                )}
              </div>
            )}
          </fieldset>
        );
      })}
      {answered === questions.length && (
        <p role="status" className="rounded-xl bg-navy px-5 py-4 text-center font-semibold text-white">
          {fmt(m.score, { score, total: questions.length })}
        </p>
      )}
    </div>
  );
}
