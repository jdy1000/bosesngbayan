/**
 * Makes any photo uploadable: a phone or camera picture is often 6000 px wide and 8 MB, but the server accepts at most
 * MAX_UPLOAD_BYTES per file (a hosting limit) and the site never shows more than ~2400 px. So before upload, an image
 * that is too big in bytes or pixels is scaled down in the browser and re-encoded; anything already small is sent as is.
 * GIFs (animation) and non-images are never touched. Browser-only (canvas).
 */
export const MAX_EDGE = 2400;
const QUALITIES = [0.86, 0.76, 0.66, 0.56];
const SHRINK_STEP = 0.8;
const MAX_ROUNDS = 6;
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** Size that fits `maxEdge` on the long side, same shape, never enlarged. */
export function fitDimensions(width: number, height: number, maxEdge: number = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));

/** The file to upload: the original when it is already small enough, else a scaled WebP copy. Falls back to the original on any failure. */
export async function fitImageForUpload(file: File, maxBytes: number): Promise<File> {
  if (!RESIZABLE.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const target = fitDimensions(bitmap.width, bitmap.height);
    const isSmall = target.width === bitmap.width && target.height === bitmap.height;
    if (isSmall && file.size <= maxBytes) {
      bitmap.close();
      return file;
    }
    let { width, height } = target;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of QUALITIES) {
        const blob = await toBlob(canvas, quality);
        // Some browsers silently answer with PNG when they cannot encode WebP; that is not what the file name would say.
        if (blob && blob.type === "image/webp" && blob.size <= maxBytes) {
          bitmap.close();
          return new File([blob], `${file.name.replace(/\.[^.]*$/, "") || "image"}.webp`, { type: "image/webp" });
        }
      }
      width = Math.max(1, Math.round(width * SHRINK_STEP));
      height = Math.max(1, Math.round(height * SHRINK_STEP));
    }
    bitmap.close();
  } catch {
    // Unreadable or unsupported in this browser: let the server judge the original.
  }
  return file;
}
