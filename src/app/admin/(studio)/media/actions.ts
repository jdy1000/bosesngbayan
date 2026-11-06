"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { fieldErrors, toActionError } from "@/lib/actions";
import type { FormActionResult } from "@/components/studio/action-form";
import { MEDIA_KINDS, kindForMime, removeObject, storeUpload } from "@/lib/studio/media";

const NOT_ALLOWED = "You don't have permission to change this media.";
const IN_USE = "This media is still in use. Remove it from the listed places before deleting.";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} characters maximum.`)
    .transform((v) => (v === "" ? null : v));
const folderSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(60, "Folder: 60 characters maximum.")
  .transform((v) => v || "pangkalahatan");
const idSchema = z.uuid("Invalid media.");

export type UploadResult = { ok: true; id: string; fileName: string } | { ok: false; error: string };

/** One file per call so each request stays under the upload size limit. */
export async function uploadMediaFile(formData: FormData): Promise<UploadResult> {
  try {
    const ctx = await requirePermission("media.upload");
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "No file selected." };
    const folder = folderSchema.safeParse(formData.get("folder") ?? "");
    if (!folder.success) return { ok: false, error: folder.error.issues[0]!.message };

    const stored = await storeUpload(ctx, file);
    if (!stored.ok) return stored;
    const f = stored.file;
    const { data, error } = await ctx.supabase
      .from("media_assets")
      .insert({
        kind: kindForMime(f.mime),
        storage_path: f.storagePath,
        file_name: f.fileName,
        mime_type: f.mime,
        size_bytes: f.size,
        width: f.width,
        height: f.height,
        title: f.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 200),
        folder: folder.data,
        uploaded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) {
      await removeObject(ctx, f.storagePath);
      return toActionError(error);
    }
    revalidatePath("/admin/media");
    return { ok: true, id: data.id, fileName: f.fileName };
  } catch (e) {
    return toActionError(e);
  }
}

const externalSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https:\/\/[^\s]+$/.test(v) && URL.canParse(v), { message: "Enter a full https:// URL." }),
  kind: z.enum(MEDIA_KINDS),
  title: optionalText(200),
  folder: folderSchema,
});

export async function addExternalMedia(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("media.upload");
    const parsed = externalSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fieldErrors(parsed.error);
    const u = new URL(parsed.data.url);
    const fileName = `${u.hostname}${u.pathname}`.slice(0, 200);
    const { data, error } = await ctx.supabase
      .from("media_assets")
      .insert({
        kind: parsed.data.kind,
        external_url: parsed.data.url,
        file_name: fileName,
        title: parsed.data.title ?? fileName,
        folder: parsed.data.folder,
        uploaded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) return toActionError(error);
    revalidatePath("/admin/media");
    return { ok: true, message: "External media added.", redirectTo: `/admin/media/${data.id}` };
  } catch (e) {
    return toActionError(e);
  }
}

const metaSchema = z.object({
  id: idSchema,
  title: optionalText(200),
  file_name: z.string().trim().min(1, "File name is required.").max(200),
  alt_text: optionalText(300),
  caption: optionalText(600),
  credit: optionalText(200),
  folder: folderSchema,
});

/** Metadata + rename. file_name is only the display label; the storage path never changes here. */
export async function updateMediaMeta(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requireAnyPermission("media.upload", "media.manage_any");
    const parsed = metaSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fieldErrors(parsed.error);
    const { id, ...fields } = parsed.data;
    const { data, error } = await ctx.supabase.from("media_assets").update(fields).eq("id", id).select("id");
    if (error) return toActionError(error);
    if (!data?.length) return { ok: false, error: NOT_ALLOWED };
    revalidatePath("/admin/media");
    return { ok: true, message: "Media details saved." };
  } catch (e) {
    return toActionError(e);
  }
}

/** Replace the file bytes: upload to a new path, repoint the row, then remove the old object. */
export async function replaceMediaFile(formData: FormData): Promise<UploadResult> {
  try {
    const ctx = await requireAnyPermission("media.upload", "media.manage_any");
    const id = idSchema.parse(formData.get("id"));
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "No file selected." };

    const { data: current, error: readError } = await ctx.supabase.from("media_assets").select("id, storage_path").eq("id", id).maybeSingle();
    if (readError) return toActionError(readError);
    if (!current?.storage_path) return { ok: false, error: "This is external media; change the URL instead of uploading." };

    const stored = await storeUpload(ctx, file);
    if (!stored.ok) return stored;
    const f = stored.file;
    const { data, error } = await ctx.supabase
      .from("media_assets")
      .update({ storage_path: f.storagePath, kind: kindForMime(f.mime), mime_type: f.mime, size_bytes: f.size, width: f.width, height: f.height, file_name: f.fileName })
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      await removeObject(ctx, f.storagePath);
      return error ? toActionError(error) : { ok: false, error: NOT_ALLOWED };
    }
    await removeObject(ctx, current.storage_path);
    revalidatePath("/admin/media");
    return { ok: true, id, fileName: f.fileName };
  } catch (e) {
    return toActionError(e);
  }
}

const externalUrlSchema = z.object({ id: idSchema, url: externalSchema.shape.url });

export async function updateExternalUrl(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requireAnyPermission("media.upload", "media.manage_any");
    const parsed = externalUrlSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fieldErrors(parsed.error);
    const { data, error } = await ctx.supabase
      .from("media_assets")
      .update({ external_url: parsed.data.url })
      .eq("id", parsed.data.id)
      .is("storage_path", null)
      .select("id");
    if (error) return toActionError(error);
    if (!data?.length) return { ok: false, error: NOT_ALLOWED };
    revalidatePath("/admin/media");
    return { ok: true, message: "URL updated." };
  } catch (e) {
    return toActionError(e);
  }
}

/** Delete is refused by the database (media_in_use) while any content still references the asset. */
export async function deleteMedia(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  let ok = false;
  try {
    const ctx = await requireAnyPermission("media.upload", "media.manage_any");
    const id = idSchema.parse(formData.get("id"));
    const { data, error } = await ctx.supabase.from("media_assets").delete().eq("id", id).select("id, storage_path");
    if (error) return error.message === "media_in_use" ? { ok: false, error: IN_USE } : toActionError(error);
    if (!data?.length) return { ok: false, error: NOT_ALLOWED };
    if (data[0]!.storage_path) await removeObject(ctx, data[0]!.storage_path);
    revalidatePath("/admin/media");
    ok = true;
  } catch (e) {
    return toActionError(e);
  }
  if (ok) redirect("/admin/media?deleted=1");
  return null;
}
