import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, MEDIA_BUCKET, imageDimensions, sniffMime, type AllowedUploadType } from "@/lib/media";
import { logServerError } from "@/lib/log";

export const MEDIA_KINDS = ["image", "video", "file"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const MEDIA_KIND_LABELS: Record<MediaKind, string> = { image: "Larawan", video: "Video", file: "File" };

export const MEDIA_LIST_COLUMNS =
  "id, kind, storage_path, external_url, file_name, mime_type, size_bytes, width, height, title, alt_text, caption, credit, folder, uploaded_by, created_at, updated_at, uploader:profiles!media_assets_uploaded_by_fkey(display_name)";

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

export function kindForMime(mime: AllowedUploadType): MediaKind {
  return mime.startsWith("image/") ? "image" : "file";
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
  if (file.size === 0) return { ok: false, error: "Walang laman ang file." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: `Lampas sa ${MAX_UPLOAD_BYTES / 1024 / 1024} MB ang file.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, error: "Hindi suportadong uri ng file. JPEG, PNG, WebP, GIF, AVIF o PDF lamang." };
  const fileName = sanitizeFileName(file.name, mime);
  const storagePath = `${ctx.userId}/${crypto.randomUUID()}-${fileName}`;
  const dims = mime.startsWith("image/") ? imageDimensions(bytes, mime) : null;

  const { error } = await ctx.supabase.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (error) {
    logServerError("media_storage_upload_failed", error);
    return { ok: false, error: "Hindi na-upload ang file. Suriin ang iyong pahintulot at subukang muli." };
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

export interface MediaUsage {
  usage_kind: string;
  ref_id: string | null;
  label: string | null;
  detail: string;
}

/** Every reference to an asset, computed in the database regardless of the caller's read access. */
export async function getMediaUsages(ctx: StaffContext, mediaId: string): Promise<MediaUsage[]> {
  const { data, error } = await ctx.supabase.rpc("media_usages", { p_media_id: mediaId });
  if (error) throw error;
  return (data ?? []) as MediaUsage[];
}

export const USAGE_LABELS: Record<string, string> = {
  article: "Artikulo",
  category: "Kategorya",
  page: "Pahina",
  site_setting: "Site settings",
  homepage_section: "Homepage section",
};

/** Links point at module index pages listed in the Studio nav (detail routes belong to other modules). */
export function usageHref(u: MediaUsage): string | null {
  switch (u.usage_kind) {
    case "article":
      return u.label ? "/admin/articles" : null;
    case "page":
      return u.label ? "/admin/pages" : null;
    case "category":
      return "/admin/taxonomy";
    case "site_setting":
      return "/admin/settings";
    case "homepage_section":
      return u.label ? `/admin/homepage#section-${u.ref_id}` : null;
    default:
      return null;
  }
}

export function formatBytes(n: number | null): string {
  if (n === null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
