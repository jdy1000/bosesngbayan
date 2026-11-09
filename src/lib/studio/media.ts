import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, MEDIA_BUCKET, imageDimensions, sniffMime, type AllowedUploadType } from "@/lib/media";
import { logServerError } from "@/lib/log";

/** Keep only characters the storage_path CHECK allows; never trust the browser-provided name. */
export function sanitizeFileName(name: string, mime: AllowedUploadType): string {
  const ext = ALLOWED_UPLOAD_TYPES[mime];
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "file"}.${ext}`;
}

export interface StoredFile {
  storagePath: string;
  fileName: string;
  mime: AllowedUploadType;
  size: number;
  width: number | null;
  height: number | null;
}

/**
 * Validate a file from its BYTES (size + magic-byte sniffing; browser MIME/extension ignored) and
 * upload it with the caller's session client into their own `<uid>/` folder. Storage RLS decides.
 */
export async function storeUpload(ctx: StaffContext, file: File): Promise<{ ok: true; file: StoredFile } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, error: "Unsupported file type. JPEG, PNG, WebP, GIF, AVIF or PDF only." };
  const fileName = sanitizeFileName(file.name, mime);
  const storagePath = `${ctx.userId}/${crypto.randomUUID()}-${fileName}`;
  const dims = mime.startsWith("image/") ? imageDimensions(bytes, mime) : null;

  const { error } = await ctx.supabase.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (error) {
    logServerError("media_storage_upload_failed", error);
    return { ok: false, error: "The file was not uploaded. Check your permissions and try again." };
  }
  return {
    ok: true,
    file: {
      storagePath,
      fileName,
      mime,
      size: file.size,
      width: dims && dims.width > 0 ? dims.width : null,
      height: dims && dims.height > 0 ? dims.height : null,
    },
  };
}

/** Best-effort cleanup of a storage object; failures are logged (orphaned objects are harmless but tracked). */
export async function removeObject(ctx: StaffContext, storagePath: string): Promise<void> {
  const { error } = await ctx.supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
  if (error) logServerError("media_storage_remove_failed", error);
}
