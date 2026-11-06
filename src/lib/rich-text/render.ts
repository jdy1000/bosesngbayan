import "server-only";
import { generateHTML } from "@tiptap/html/server";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { richTextExtensions } from "@/lib/rich-text/extensions";

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

const YOUTUBE_EMBED = /^https:\/\/(www\.)?(youtube-nocookie\.com|youtube\.com)\/embed\/[A-Za-z0-9_-]{6,20}(\?[^"'<>\s]*)?$/;

/** Allowlist sanitizer — the last line of defense against stored XSS in article/page bodies. */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "strong", "em", "u", "s", "code", "pre", "a", "ul", "ol", "li", "blockquote", "hr", "br",
      "figure", "figcaption", "img", "span", "div", "iframe", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "loading", "decoding", "width", "height"],
      figure: ["data-figure", "data-media-id"],
      span: ["data-caption", "data-credit", "class"],
      blockquote: ["data-variant"],
      div: ["data-youtube-video"],
      iframe: ["src", "width", "height", "allowfullscreen", "allow", "title", "loading", "frameborder"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      col: ["style"],
    },
    allowedClasses: { span: ["credit"] },
    allowedStyles: { col: { "min-width": [/^\d+px$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"], iframe: ["https"] },
    allowProtocolRelative: false,
    exclusiveFilter: (frame) => frame.tag === "iframe" && !YOUTUBE_EMBED.test(frame.attribs.src ?? ""),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: "lazy", title: attribs.title || "Naka-embed na video" },
      }),
    },
  });
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h[2-4]|li|blockquote|figcaption|tr)>/g, "$& "), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** ~200 words per minute (Filipino/English mixed prose), minimum 1. */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(240, Math.max(1, Math.round(words / 200)));
}

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
