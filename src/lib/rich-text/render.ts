import "server-only";
import { generateHTML } from "@tiptap/html/server";
import { z } from "zod";
import { richTextExtensions } from "@/lib/rich-text/extensions";
import { htmlToText, readingMinutes, sanitizeRichHtml } from "@/lib/rich-text/sanitize";

export { htmlToText, readingMinutes, sanitizeRichHtml };

/** Minimal structural validation of a TipTap document before rendering. */
const nodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: z.string().max(40),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(nodeSchema).max(5000).optional(),
      marks: z.array(z.object({ type: z.string().max(40), attrs: z.record(z.string(), z.unknown()).optional() })).optional(),
      text: z.string().max(100_000).optional(),
    })
    .loose(),
);

export const richTextDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(nodeSchema).max(5000).default([]) })
  .loose();

export type RichTextDoc = z.infer<typeof richTextDocSchema>;

export const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };

export interface RenderedDoc {
  doc: RichTextDoc;
  html: string;
  text: string;
  readingMinutes: number;
}

/** Validate → render with the shared extensions → sanitize. Throws ZodError on malformed input. */
export function renderRichText(input: unknown): RenderedDoc {
  const doc = richTextDocSchema.parse(input);
  const raw = doc.content.length === 0 ? "" : generateHTML(doc as Parameters<typeof generateHTML>[0], richTextExtensions());
  const html = sanitizeRichHtml(raw);
  const text = htmlToText(html);
  return { doc, html, text, readingMinutes: readingMinutes(text) };
}
