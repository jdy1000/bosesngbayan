"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { MediaPickerItem } from "@/app/admin/api/media/route";
import { uploadImage } from "@/app/admin/(studio)/_media/actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/media";

export interface PickedMedia {
  id: string;
  url: string | null;
  alt_text: string | null;
  file_name?: string;
}

/**
 * Image picker for Studio forms. Renders a hidden input `name` holding the media id (or "" for none)
 * so it works inside plain server-action forms. New images are uploaded from the dialog (with alt text).
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  // Plain inputs + click handler: the picker usually sits inside another <form>, and forms cannot nest.
  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setUploadError("Choose an image file.");
    if (!alt.trim()) return setUploadError("Describe the image (alt text).");
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError(`The file is over ${MAX_UPLOAD_MB} MB.`);
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("alt_text", alt);
    fd.set("caption", caption);
    fd.set("credit", credit);
    try {
      const r = await uploadImage(fd);
      if (!r.ok) return setUploadError(r.error);
      setAlt("");
      setCaption("");
      setCredit("");
      if (fileRef.current) fileRef.current.value = "";
      choose(r.media);
    } catch {
      setUploadError("The file could not be sent. Try again.");
    } finally {
      setUploading(false);
    }
  }

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
            placeholder="Search images…"
            className="field"
            autoFocus
          />
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3 border-b border-line bg-surface p-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">
            Upload a new image
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="field mt-1 py-2" disabled={uploading} />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Alt text
            <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} placeholder="What the image shows" className="field mt-1" disabled={uploading} />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Caption <span className="font-normal text-muted">(optional)</span>
            <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={600} className="field mt-1" disabled={uploading} />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Credit <span className="font-normal text-muted">(optional)</span>
            <input type="text" value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={200} className="field mt-1" disabled={uploading} />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="button" onClick={upload} disabled={uploading} className="btn btn-primary min-h-10 px-4 text-sm">
              {uploading ? "Uploading…" : "Upload and use"}
            </button>
            <p className="text-xs text-muted">JPEG, PNG, WebP, GIF or AVIF · up to {MAX_UPLOAD_MB} MB.</p>
          </div>
          {uploadError && (
            <p role="alert" className="text-sm font-medium text-accent-700 sm:col-span-2">
              {uploadError}
            </p>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-4">
          {status === "error" && <p className="text-sm text-accent-700">Could not load media. Try again.</p>}
          {status !== "error" && items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              {status === "loading" ? "Loading…" : "No images found. Upload one above."}
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
