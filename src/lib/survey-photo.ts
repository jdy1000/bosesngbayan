import type { CSSProperties } from "react";

/**
 * How a survey candidate's photo sits in its card frame, shared by the public card and the Studio preview so the two
 * can never disagree. x / y: the focal point as a percentage of the photo (CSS object-position); zoom: percent,
 * magnified around that same point. The defaults reproduce the original framing: centred, from the top, no zoom.
 */
export interface PhotoPosition {
  x: number;
  y: number;
  zoom: number;
}

export const PHOTO_DEFAULTS: PhotoPosition = { x: 50, y: 0, zoom: 100 };

export function photoStyle({ x, y, zoom }: PhotoPosition): CSSProperties {
  return {
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    transform: zoom === 100 ? undefined : `scale(${zoom / 100})`,
  };
}
