"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/media";
import { replaceMediaFile, uploadMediaFile, type UploadResult } from "./actions";

type RowStatus = { name: string; state: "waiting" | "uploading" | "done" | "error"; message?: string };
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf";

/** Uploads files one request at a time; the server re-validates every file from its bytes. */
export function MediaUploader({ folders }: { folders: string[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowStatus[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
    const folder = (form.elements.namedItem("folder") as HTMLInputElement).value;
    if (files.length === 0) return;
    setBusy(true);
    let current: RowStatus[] = files.map((f) => ({ name: f.name, state: "waiting" }));
    setRows(current);
    for (const [i, file] of files.entries()) {
      const update = (patch: Partial<RowStatus>) => {
        current = current.map((r, j) => (j === i ? { ...r, ...patch } : r));
        setRows(current);
      };
      if (file.size > MAX_UPLOAD_BYTES) {
        update({ state: "error", message: `Over ${MAX_UPLOAD_MB} MB.` });
        continue;
      }
      update({ state: "uploading" });
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", folder);
      let result: UploadResult;
      try {
        result = await uploadMediaFile(fd);
      } catch {
        result = { ok: false, error: "The file could not be sent (network or request size)." };
      }
      update(result.ok ? { state: "done", message: "Uploaded" } : { state: "error", message: result.error });
    }
    setBusy(false);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="media-files" className="mb-1.5 block text-sm font-semibold text-ink">
            Files
          </label>
          <input id="media-files" name="files" type="file" multiple accept={ACCEPT} required className="field py-2" disabled={busy} />
          <p className="mt-1 text-xs text-muted">JPEG, PNG, WebP, GIF, AVIF or PDF · up to {MAX_UPLOAD_MB} MB per file.</p>
        </div>
        <div>
          <label htmlFor="media-folder" className="mb-1.5 block text-sm font-semibold text-ink">
            Folder
          </label>
          <input id="media-folder" name="folder" list="media-folders" placeholder="pangkalahatan" maxLength={60} className="field" disabled={busy} />
          <datalist id="media-folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary min-h-10 px-4 text-sm">
        {busy ? "Uploading…" : "Upload"}
      </button>
      {rows.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm" aria-live="polite">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate">{r.name}</span>
              <span
                className={`shrink-0 text-xs font-semibold ${r.state === "error" ? "text-accent-700" : r.state === "done" ? "text-emerald-700" : "text-muted"}`}
              >
                {r.state === "waiting" ? "Waiting" : r.state === "uploading" ? "Uploading…" : r.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function ReplaceFileForm({ id }: { id: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return setStatus({ ok: false, text: `The file is over ${MAX_UPLOAD_MB} MB.` });
    if (!window.confirm("This replaces the file everywhere it is used. Continue?")) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("file", file);
    try {
      const r = await replaceMediaFile(fd);
      setStatus(r.ok ? { ok: true, text: "File replaced." } : { ok: false, text: r.error });
      if (r.ok) {
        form.reset();
        router.refresh();
      }
    } catch {
      setStatus({ ok: false, text: "The file could not be sent. Try again." });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="replace-file" className="block text-sm font-semibold text-ink">
        New file
      </label>
      <input id="replace-file" name="file" type="file" accept={ACCEPT} required className="field py-2" disabled={busy} />
      <button type="submit" disabled={busy} className="btn btn-outline min-h-10 px-4 text-sm">
        {busy ? "Replacing…" : "Replace file"}
      </button>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium ${status.ok ? "text-emerald-700" : "text-accent-700"}`}>
          {status.text}
        </p>
      )}
    </form>
  );
}
