"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError } from "@/lib/actions";
import { mediaUrl } from "@/lib/media";
import { removeObject, storeUpload } from "@/lib/studio/media";
import type { PickedMedia } from "@/components/studio/media-picker";

const metaSchema = z.object({
  alt_text: z.string().trim().min(1, "Describe the image (alt text).").max(300, "Alt text: 300 characters maximum."),
  caption: z.string().trim().max(600, "Caption: 600 characters maximum.").transform((v) => v || null),
  credit: z.string().trim().max(200, "Credit: 200 characters maximum.").transform((v) => v || null),
});

export type ImageUploadResult = { ok: true; media: PickedMedia } | { ok: false; error: string };

/** Upload one image from a picker (editor, ads, settings). The server re-validates the bytes; only images are accepted. */
export async function uploadImage(formData: FormData): Promise<ImageUploadResult> {
  try {
    const ctx = await requirePermission("media.upload");
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "No file selected." };
    const meta = metaSchema.safeParse({
      alt_text: formData.get("alt_text") ?? "",
      caption: formData.get("caption") ?? "",
      credit: formData.get("credit") ?? "",
    });
    if (!meta.success) return { ok: false, error: meta.error.issues[0]!.message };

    const stored = await storeUpload(ctx, file);
    if (!stored.ok) return stored;
    const f = stored.file;
    if (!f.mime.startsWith("image/")) {
      await removeObject(ctx, f.storagePath);
      return { ok: false, error: "Choose an image: JPEG, PNG, WebP, GIF or AVIF." };
    }
    const { data, error } = await ctx.supabase
      .from("media_assets")
      .insert({
        kind: "image",
        storage_path: f.storagePath,
        file_name: f.fileName,
        mime_type: f.mime,
        size_bytes: f.size,
        width: f.width,
        height: f.height,
        title: f.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 200),
        ...meta.data,
        uploaded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) {
      await removeObject(ctx, f.storagePath);
      return toActionError(error);
    }
    return { ok: true, media: { id: data.id, url: mediaUrl({ storage_path: f.storagePath, external_url: null }), alt_text: meta.data.alt_text, file_name: f.fileName } };
  } catch (e) {
    return toActionError(e);
  }
}
