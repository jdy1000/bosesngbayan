import { z } from "zod";

/** Zod helpers for FormData-backed server actions. */

/** Trimmed optional text; empty string becomes null. */
export function optionalText(max: number, message = `Hanggang ${max} character lamang.`) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().max(max, message).nullable(),
  );
}

export function requiredText(min: number, max: number, label: string) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(min, `${label}: kailangan ng hindi bababa sa ${min} character.`).max(max, `${label}: hanggang ${max} character lamang.`),
  );
}

/** HTML checkbox: present ("on") → true, absent → false. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

/** Optional uuid from a <select>; "" → null. */
export const optionalUuid = z.preprocess((v) => (typeof v === "string" && v !== "" ? v : null), z.uuid().nullable());

export const slugField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : ""),
  z.string().max(140, "Masyadong mahaba ang slug.").regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Slug: maliliit na titik, numero at gitling lamang."),
);
