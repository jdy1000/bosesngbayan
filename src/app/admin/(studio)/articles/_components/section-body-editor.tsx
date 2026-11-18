"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { MediaPicker } from "@/components/studio/media-picker";
import { moveId } from "@/lib/studio/reorder";
import { SECTION_KINDS, SECTION_LABELS, sectionsToDoc, type Section, type SectionKind } from "@/lib/rich-text/sections";

function blank(id: string, kind: SectionKind): Section {
  switch (kind) {
    case "heading":
      return { id, kind, level: 2, text: "" };
    case "paragraph":
      return { id, kind, text: "" };
    case "image":
      return { id, kind, mediaId: null, src: "", alt: "", caption: "", credit: "" };
    case "quote":
      return { id, kind, text: "", pull: false };
    case "list":
      return { id, kind, ordered: false, text: "" };
    case "embed":
      return { id, kind, url: "" };
  }
}

const iconButton = "inline-flex size-9 items-center justify-center rounded-[7px] bg-brand text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.96]";

function AddButtons({ onAdd }: { onAdd: (kind: SectionKind) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {SECTION_KINDS.map((k) => (
        <button key={k} type="button" onClick={() => onAdd(k)} className="btn btn-primary min-h-10 rounded-[7px] px-3.5 text-sm">
          + {SECTION_LABELS[k]}
        </button>
      ))}
    </div>
  );
}

/**
 * The article body as stacked sections (Heading, Paragraph, Image, Quote, List, Embed), each with move and remove
 * buttons. The parent owns the list; this renders it and the hidden `body` field the save action reads, which holds the
 * same TipTap document the site renders from (see src/lib/rich-text/sections.ts).
 */
export function SectionBodyEditor({
  sections,
  onChange,
  disabled,
}: {
  sections: Section[];
  /** Takes an updater, like setState, so a late event (an image upload finishing) never overwrites newer typing. */
  onChange: (update: (current: Section[]) => Section[]) => void;
  disabled: boolean;
}) {
  const seq = useRef(0);
  const newId = () => `n${++seq.current}`;
  const set = (id: string, patch: Partial<Section>) => onChange((cur) => cur.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));
  const move = (id: string, direction: "up" | "down") =>
    onChange((cur) => {
      const order = moveId(cur.map((s) => s.id), id, direction);
      return order.map((sid) => cur.find((s) => s.id === sid)!);
    });
  const insertAfter = (id: string, kind: SectionKind) =>
    onChange((cur) => {
      const next = [...cur];
      next.splice(cur.findIndex((s) => s.id === id) + 1, 0, blank(newId(), kind));
      return next;
    });
  const append = (kind: SectionKind) => onChange((cur) => [...cur, blank(newId(), kind)]);
  const remove = (id: string) => onChange((cur) => cur.filter((s) => s.id !== id));

  return (
    <div>
      <input type="hidden" name="body" value={JSON.stringify(sectionsToDoc(sections))} />
      <div className="space-y-4">
        {sections.length === 0 && <p className="rounded-[10px] border border-dashed border-line px-5 py-8 text-center text-sm text-muted">No sections yet. Add the first one below.</p>}
        {sections.map((s, i) => (
          <div key={s.id} id={`section-${s.id}`} className="rounded-[10px] border border-line bg-paper p-5 shadow-[var(--shadow-panel)]">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                {SECTION_LABELS[s.kind]}
              </p>
              {!disabled && (
                <div className="flex gap-1.5">
                  <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(s.id, "up")} aria-label={`Move ${SECTION_LABELS[s.kind]} section ${i + 1} up`}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={iconButton} disabled={i === sections.length - 1} onClick={() => move(s.id, "down")} aria-label={`Move ${SECTION_LABELS[s.kind]} section ${i + 1} down`}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={`${iconButton} !bg-navy hover:!bg-navy-900`} onClick={() => remove(s.id)} aria-label={`Remove ${SECTION_LABELS[s.kind]} section ${i + 1}`}>
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <SectionFields s={s} set={(patch) => set(s.id, patch)} disabled={disabled} />
            </div>

            {!disabled && (
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-brand hover:underline">+ Add section below</summary>
                <div className="mt-3">
                  <AddButtons onAdd={(k) => insertAfter(s.id, k)} />
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <div className="mt-6">
          <p className="mb-2.5 text-sm font-semibold text-ink">Add section</p>
          <AddButtons onAdd={append} />
          <p className="mt-2.5 text-xs text-muted">Keep adding sections in the order you want readers to see them.</p>
        </div>
      )}
    </div>
  );
}

const label = "mb-2 block text-sm font-semibold text-ink";

function SectionFields({ s, set, disabled }: { s: Section; set: (patch: Partial<Section>) => void; disabled: boolean }) {
  const id = `f-${s.id}`;
  switch (s.kind) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <div>
            <label htmlFor={`${id}-level`} className={label}>
              Level
            </label>
            <select id={`${id}-level`} className="field" disabled={disabled} value={s.level} onChange={(e) => set({ level: Number(e.target.value) as 2 | 3 | 4 })}>
              <option value={2}>Heading</option>
              <option value={3}>Subheading</option>
              <option value={4}>Small heading</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-text`} className={label}>
              Heading text
            </label>
            <input id={`${id}-text`} className="field" disabled={disabled} maxLength={300} placeholder="Heading text" value={s.text} onChange={(e) => set({ text: e.target.value })} />
          </div>
        </div>
      );
    case "paragraph":
      return (
        <div>
          <label htmlFor={`${id}-text`} className={label}>
            Paragraph text
          </label>
          <textarea id={`${id}-text`} className="field min-h-36" disabled={disabled} placeholder="Paragraph text" value={s.text} onChange={(e) => set({ text: e.target.value })} />
          <p className="mt-1.5 text-xs text-muted">Leave a blank line between paragraphs. Use **bold**, *italic* and [link text](https://…) for formatting.</p>
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <MediaPicker
            name={`_image_${s.id}`}
            label="Image"
            defaultValue={s.src ? { id: s.mediaId ?? "", url: s.src, alt_text: s.alt } : null}
            onChange={(m) => set({ mediaId: m?.id ?? null, src: m?.url ?? "", alt: m?.alt_text ?? "" })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${id}-alt`} className={label}>
                Image description (alt text)
              </label>
              <input id={`${id}-alt`} className="field" disabled={disabled} maxLength={300} value={s.alt} onChange={(e) => set({ alt: e.target.value })} />
              <p className="mt-1.5 text-xs text-muted">Read aloud to people who cannot see the image.</p>
            </div>
            <div>
              <label htmlFor={`${id}-caption`} className={label}>
                Caption (optional)
              </label>
              <input id={`${id}-caption`} className="field" disabled={disabled} maxLength={300} value={s.caption} onChange={(e) => set({ caption: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${id}-credit`} className={label}>
                Photo credit (optional)
              </label>
              <input id={`${id}-credit`} className="field" disabled={disabled} maxLength={160} value={s.credit} onChange={(e) => set({ credit: e.target.value })} />
            </div>
          </div>
        </div>
      );
    case "quote":
      return (
        <div>
          <label htmlFor={`${id}-text`} className={label}>
            Quote text
          </label>
          <textarea id={`${id}-text`} className="field min-h-24" disabled={disabled} placeholder="Quote text" value={s.text} onChange={(e) => set({ text: e.target.value })} />
          <label className="mt-2.5 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" disabled={disabled} checked={s.pull} onChange={(e) => set({ pull: e.target.checked })} className="size-4" /> Pull quote (larger, set apart from the text)
          </label>
        </div>
      );
    case "list":
      return (
        <div>
          <label htmlFor={`${id}-text`} className={label}>
            List items
          </label>
          <textarea id={`${id}-text`} className="field min-h-28" disabled={disabled} placeholder="One item per line" value={s.text} onChange={(e) => set({ text: e.target.value })} />
          <label className="mt-2.5 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" disabled={disabled} checked={s.ordered} onChange={(e) => set({ ordered: e.target.checked })} className="size-4" /> Numbered list
          </label>
        </div>
      );
    case "embed":
      return (
        <div>
          <label htmlFor={`${id}-url`} className={label}>
            YouTube link
          </label>
          <input id={`${id}-url`} type="url" className="field" disabled={disabled} placeholder="https://www.youtube.com/watch?v=…" value={s.url} onChange={(e) => set({ url: e.target.value })} />
        </div>
      );
    case "raw":
      return <p className="text-sm text-ink-soft">This {s.label.toLowerCase()} from the earlier editor is kept exactly as it was. You can move or remove it, but not edit it here.</p>;
  }
}
