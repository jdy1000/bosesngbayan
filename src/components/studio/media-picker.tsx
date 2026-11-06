"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { MediaPickerItem } from "@/app/admin/api/media/route";

export interface PickedMedia {
  id: string;
  url: string | null;
  alt_text: string | null;
  file_name?: string;
}

/**
 * Image picker for Studio forms. Renders a hidden input `name` holding the media id (or "" for none)
 * so it works inside plain server-action forms. Images are uploaded in the Media Library.
 */
export function MediaPicker({
  name,
  label = "Image",
  defaultValue = null,
  onChange,
}: {
  name: string;
  label?: string;
  defaultValue?: PickedMedia | null;
  onChange?: (media: PickedMedia | null) => void;
}) {
  const [value, setValue] = useState<PickedMedia | null>(defaultValue);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaPickerItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/admin/api/media?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setItems(((await res.json()) as { items: MediaPickerItem[] }).items);
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [open, q]);

  function choose(m: PickedMedia | null) {
    setValue(m);
    onChange?.(m);
    setOpen(false);
  }

  return (
    <div>
      <input type="hidden" name={name} value={value?.id ?? ""} />
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
          {value?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment
            <img src={value.url} alt={value.alt_text ?? ""} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" className="btn btn-outline min-h-9 px-3 text-sm" onClick={() => setOpen(true)}>
            {value ? "Change" : "Choose image"}
          </button>
          {value && (
            <button type="button" className="text-xs font-semibold text-accent-700 hover:underline" onClick={() => choose(null)}>
              Remove
            </button>
          )}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(920px,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-black/50"
        aria-label="Choose image"
      >
        <div className="flex items-center gap-3 border-b border-line p-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Media Library…"
            className="field"
            autoFocus
          />
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {status === "error" && <p className="text-sm text-accent-700">Could not load media. Try again.</p>}
          {status !== "error" && items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              {status === "loading" ? "Loading…" : "Nothing found. Upload images in the Media Library first."}
            </p>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => choose({ id: m.id, url: m.url, alt_text: m.alt_text, file_name: m.file_name })}
                  className={`group w-full overflow-hidden rounded-lg border text-left ${value?.id === m.id ? "border-brand ring-2 ring-brand" : "border-line hover:border-brand"}`}
                >
                  <div className="aspect-[4/3] bg-surface">
                    {m.url && (
                      // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail
                      <img src={m.url} alt={m.alt_text ?? ""} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-xs text-ink-soft">{m.title || m.file_name}</p>
                  {!m.alt_text && <p className="px-2 pb-1.5 text-[0.7rem] font-semibold text-amber-700">No alt text</p>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  );
}
