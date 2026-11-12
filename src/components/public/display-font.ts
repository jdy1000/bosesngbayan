import { Lora } from "next/font/google";

/**
 * Serif for the cover story headline only (owner reference, 2026-11-09). Body and every other headline stay
 * Inter. Declared here instead of in the root layout so Next preloads it only on routes that render the cover.
 * Variable font: weights come from Tailwind's font-weight classes. Latin subset covers Filipino (ñ).
 */
export const displayFont = Lora({
  subsets: ["latin"],
  display: "swap",
});
