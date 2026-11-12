import { Lora } from "next/font/google";

/**
 * Serif for the cover story headline only (owner reference, 2026-11-09). Body and every other headline stay
 * Inter. Declared here instead of in the root layout so Next preloads it only on routes that render the cover.
 * One weight only (600, the cover's font-semibold): the single-weight file is smaller than the variable one, and
 * this font is preloaded beside the cover photo. Latin subset covers Filipino (ñ).
 */
export const displayFont = Lora({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
});
