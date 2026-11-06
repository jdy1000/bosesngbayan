"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { MediaPicker } from "@/components/studio/media-picker";
import type { BuilderOptions, Option, PickedArticle } from "../types";

/** Controlled inputs for block settings. The server re-validates everything with the block schema. */

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export function TextField({
  label,
  value,
  onChange,
  max,
  multiline = false,
  hint,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline?: boolean;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {multiline ? (
        <textarea id={id} value={value} maxLength={max} rows={3} onChange={(e) => onChange(e.target.value)} className="field" />
      ) : (
        <input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="field" />
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        className="field tabular-nums"
      />
      <p className="mt-1 text-xs text-muted">
        {min}–{max}
      </p>
    </div>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
      {label}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  noneLabel,
}: {
  label: string;
  value: T | "";
  onChange: (v: T | "") => void;
  options: readonly { value: T; label: string }[];
  noneLabel?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T | "")} className="field">
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Pick one id from a list, or none. */
export function OptionSelect({ label, value, onChange, options, noneLabel }: { label: string; value: string | null; onChange: (v: string | null) => void; options: Option[]; noneLabel: string }) {
  return (
    <SelectField
      label={label}
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
      options={options.map((o) => ({ value: o.id, label: o.label }))}
      noneLabel={noneLabel}
    />
  );
}

type Link = { label: string; label_en: string; href: string } | null;

export function LinkField({ label, value, onChange }: { label: string; value: Link; onChange: (v: Link) => void }) {
  const id = useId();
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-semibold text-ink">{label}</legend>
      <CheckField label="Has a link" checked={value !== null} onChange={(on) => onChange(on ? { label: "", label_en: "", href: "/" } : null)} />
      {value && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-l`} className={labelCls}>
              Label
            </label>
            <input id={`${id}-l`} value={value.label} maxLength={60} onChange={(e) => onChange({ ...value, label: e.target.value })} className="field" />
          </div>
          <div>
            <label htmlFor={`${id}-le`} className={labelCls}>
              Label in English <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id={`${id}-le`} value={value.label_en ?? ""} maxLength={60} onChange={(e) => onChange({ ...value, label_en: e.target.value })} className="field" />
          </div>
          <div>
            <label htmlFor={`${id}-h`} className={labelCls}>
              Destination
            </label>
            <input
              id={`${id}-h`}
              value={value.href}
              maxLength={500}
              placeholder="/botohan or https://…"
              onChange={(e) => onChange({ ...value, href: e.target.value })}
              className="field"
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function MultiOptionField({ label, value, onChange, options, max }: { label: string; value: string[]; onChange: (v: string[]) => void; options: Option[]; max: number }) {
  const known = new Map(options.map((o) => [o.id, o.label]));
  return (
    <fieldset>
      <legend className={labelCls}>
        {label} <span className="font-normal text-muted">({value.length}/{max}, in the order selected)</span>
      </legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted">Nothing to choose from.</p>
      ) : (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-line p-2">
          {options.map((o) => {
            const checked = value.includes(o.id);
            return (
              <label key={o.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-surface">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && value.length >= max}
                  onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((v) => v !== o.id))}
                  className="h-4 w-4"
                />
                {o.label}
              </label>
            );
          })}
        </div>
      )}
      {value.some((v) => !known.has(v)) && <p className="mt-1 text-xs text-amber-700">Some selected items can no longer be found (they may be deleted or inactive).</p>}
    </fieldset>
  );
}

export function MediaField({ label, value, onChange, options }: { label: string; value: string | null; onChange: (v: string | null) => void; options: BuilderOptions }) {
  const name = useId();
  const initial = value ? (options.mediaMap[value] ?? { id: value, url: null, alt_text: null }) : null;
  return <MediaPicker name={`_unused${name}`} label={label} defaultValue={initial} onChange={(m) => onChange(m?.id ?? null)} />;
}

/** Ordered manual selection of published articles via the builder search endpoint. */
export function ArticlePicker({ label, value, onChange, max, options }: { label: string; value: string[]; onChange: (v: string[]) => void; max: number; options: BuilderOptions }) {
  const id = useId();
  const [known, setKnown] = useState<Record<string, PickedArticle>>(options.articleMap);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedArticle[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/admin/homepage/articles?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults(((await res.json()) as { items: PickedArticle[] }).items);
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };

  return (
    <div>
      <p className={labelCls}>
        {label} <span className="font-normal text-muted">({value.length}/{max})</span>
      </p>
      {value.length > 0 && (
        <ol className="mb-2 divide-y divide-line rounded-lg border border-line text-sm">
          {value.map((aid, i) => (
            <li key={aid} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                {known[aid]?.title ?? "Article not found"}
                {known[aid] && !known[aid].published && <span className="ml-1 text-xs font-semibold text-amber-700">(not published — will not be shown)</span>}
              </span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((v) => v !== aid))} className="rounded p-1 text-accent-700 hover:bg-surface-2" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <label htmlFor={id} className="sr-only">
        Search articles
      </label>
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search published articles…" className="field" />
      <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-line text-sm" aria-live="polite">
        {status === "error" && <li className="px-3 py-2 text-accent-700">Couldn’t load articles.</li>}
        {status !== "error" && results.length === 0 && <li className="px-3 py-2 text-muted">{status === "loading" ? "Searching…" : "Nothing found."}</li>}
        {results.map((a) => {
          const picked = value.includes(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={picked || value.length >= max}
                onClick={() => {
                  setKnown((k) => ({ ...k, [a.id]: a }));
                  onChange([...value, a.id]);
                }}
                className="w-full truncate px-3 py-2 text-left hover:bg-surface disabled:text-muted"
              >
                {picked ? "✓ " : "+ "}
                {a.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
