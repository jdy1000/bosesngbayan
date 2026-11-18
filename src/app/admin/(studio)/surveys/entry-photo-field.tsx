"use client";

import { useState } from "react";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import { PHOTO_DEFAULTS, photoStyle } from "@/lib/survey-photo";

const range = "h-2 w-full cursor-pointer accent-[var(--color-brand)]";

/**
 * The candidate's photo and how it sits in the card: pick or upload the image, then slide the focal point and zoom while
 * a preview, framed exactly like the homepage card (same shape, same CSS), shows the result. The three numbers travel
 * as hidden fields beside the media id.
 */
export function EntryPhotoField({ photo, x, y, zoom }: { photo: PickedMedia | null; x: number; y: number; zoom: number }) {
  const [media, setMedia] = useState<PickedMedia | null>(photo);
  const [pos, setPos] = useState({ x, y, zoom });
  const slider = (key: "x" | "y" | "zoom", label: string, min: number, max: number) => (
    <label className="block text-sm font-semibold text-ink">
      <span className="flex items-baseline justify-between">
        {label}
        <span className="text-xs font-normal text-muted tabular-nums">{pos[key]}%</span>
      </span>
      <input type="range" min={min} max={max} step={1} value={pos[key]} onChange={(e) => setPos((p) => ({ ...p, [key]: Number(e.target.value) }))} className={`mt-1.5 ${range}`} />
    </label>
  );

  return (
    <div>
      <MediaPicker name="photo_id" label="Photo" defaultValue={photo} onChange={setMedia} />
      <input type="hidden" name="photo_x" value={pos.x} />
      <input type="hidden" name="photo_y" value={pos.y} />
      <input type="hidden" name="photo_zoom" value={pos.zoom} />
      {media?.url ? (
        <div className="mt-3 grid gap-4 @sm:grid-cols-[9.5rem_1fr] @sm:items-start">
          <div aria-hidden="true" className="relative aspect-square w-40 overflow-hidden rounded-md border border-line bg-surface-2 @sm:w-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- Studio preview; Supabase URL varies per environment */}
            <img src={media.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={photoStyle(pos)} />
          </div>
          <div className="space-y-3">
            {slider("x", "Left ↔ right", 0, 100)}
            {slider("y", "Top ↕ bottom", 0, 100)}
            {slider("zoom", "Zoom", 100, 300)}
            <button type="button" className="text-[13px] font-bold text-brand hover:underline" onClick={() => setPos({ ...PHOTO_DEFAULTS })}>
              Reset position
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-xs leading-[1.5] text-muted">Choose a photo to place it in the card.</p>
      )}
      <p className="mt-2 text-xs leading-[1.5] text-muted">Any image works, landscape or portrait, any size. The preview shows exactly what the card will show.</p>
    </div>
  );
}
