import { z } from "zod";

/** Zod helpers for FormData-backed server actions. */

/** Trimmed optional text; empty string becomes null. */
export function optionalText(max: number, message = `Up to ${max} characters.`) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().max(max, message).nullable(),
  );
}

export function requiredText(min: number, max: number, label: string) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(min, `${label}: at least ${min} characters required.`).max(max, `${label}: up to ${max} characters.`),
  );
}

/** HTML checkbox: present ("on") → true, absent → false. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

/** Optional uuid from a <select>; "" → null. */
export const optionalUuid = z.preprocess((v) => (typeof v === "string" && v !== "" ? v : null), z.uuid().nullable());

export const slugField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : ""),
  z.string().max(140, "The slug is too long.").regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Slug: lowercase letters, numbers and hyphens only."),
);
