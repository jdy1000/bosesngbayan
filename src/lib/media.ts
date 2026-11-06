import { publicEnv } from "@/lib/env";

export const MEDIA_BUCKET = "media";
// shortcut: uploads go through a server action, and Vercel caps function bodies at 4.5 MB; for larger files
// switch to signed direct-to-storage uploads with a server-side byte check afterwards.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;
export const ALLOWED_UPLOAD_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
} as const;
export type AllowedUploadType = keyof typeof ALLOWED_UPLOAD_TYPES;

export interface MediaRef {
  id: string;
  storage_path: string | null;
  external_url: string | null;
  alt_text: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
}

/** Public URL for a media asset in the public `media` bucket (or its external URL). */
export function mediaUrl(media: Pick<MediaRef, "storage_path" | "external_url"> | null | undefined): string | null {
  if (!media) return null;
  if (media.storage_path) {
    const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
    return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${media.storage_path}`;
  }
  return media.external_url;
}

/** Validate magic bytes so a renamed executable cannot pass as an image. */
export function sniffMime(bytes: Uint8Array): AllowedUploadType | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66)
    return "image/avif";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

/** Read width/height from PNG/JPEG/GIF/WebP headers without an image library. */
export function imageDimensions(bytes: Uint8Array, mime: AllowedUploadType): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime === "image/png") return { width: view.getUint32(16), height: view.getUint32(20) };
    if (mime === "image/gif") return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    if (mime === "image/webp") {
      const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
      if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X")
        return {
          width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)),
          height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)),
        };
      return null;
    }
    if (mime === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1]!;
        const length = view.getUint16(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}
