/**
 * The article body as a list of sections (Heading, Paragraph, Image, Quote, List, Embed) and back.
 *
 * Studio's editor edits sections; what is stored is still the same TipTap document, so rendering, sanitizing,
 * search text and every existing article keep working. Pure functions, no server-only imports: they run in the
 * browser editor and in tests.
 *
 * Paragraph-like text uses a tiny markup so existing bold, italic and links survive a round trip:
 *   **bold**  *italic*  [label](https://link)   a single line break = new line, a blank line = new paragraph.
 * A backslash escapes the next character (\* \[ \] \\). Anything this editor cannot express (tables, dividers, code,
 * underline, nested lists …) is kept untouched as a "raw" section instead of being flattened.
 */

export type Section =
  | { id: string; kind: "heading"; level: 2 | 3 | 4; text: string }
  | { id: string; kind: "paragraph"; text: string }
  | { id: string; kind: "image"; mediaId: string | null; src: string; alt: string; caption: string; credit: string }
  | { id: string; kind: "quote"; text: string; pull: boolean }
  | { id: string; kind: "list"; ordered: boolean; text: string }
  | { id: string; kind: "embed"; url: string }
  | { id: string; kind: "raw"; node: unknown; label: string };

export type SectionKind = Exclude<Section["kind"], "raw">;
export const SECTION_KINDS: readonly SectionKind[] = ["heading", "paragraph", "image", "quote", "list", "embed"];
export const SECTION_LABELS: Record<Section["kind"], string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  quote: "Quote",
  list: "List",
  embed: "Embed",
  raw: "Kept as written",
};

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface TextNode {
  type: "text";
  text: string;
  marks?: Mark[];
}
type Inline = TextNode | { type: "hardBreak" };
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: Mark[] };

const LINK = /^(https?:\/\/|mailto:)[^\s)]+$/;
const YOUTUBE = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)[^\s]+$/;

export const isEmbedUrl = (url: string) => YOUTUBE.test(url.trim());

// ---------------------------------------------------------------------------
// Inline markup <-> TipTap inline nodes
// ---------------------------------------------------------------------------
const escapeInline = (s: string) => s.replace(/[\\*[\]]/g, "\\$&");

/** Index of the first unescaped `token` at or after `from`, or -1. */
function findClose(src: string, token: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src.startsWith(token, i)) return i;
  }
  return -1;
}

function matchLink(src: string, at: number): { label: string; href: string; end: number } | null {
  const close = findClose(src, "]", at + 1);
  if (close < 0 || src[close + 1] !== "(") return null;
  const end = src.indexOf(")", close + 2);
  if (end < 0) return null;
  const href = src.slice(close + 2, end);
  return LINK.test(href) ? { label: src.slice(at + 1, close), href, end: end + 1 } : null;
}

function scan(src: string, marks: Mark[]): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push(marks.length ? { type: "text", text: buf, marks } : { type: "text", text: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === "\\" && i + 1 < src.length) {
      buf += src[i + 1];
      i += 2;
    } else if (c === "\n") {
      flush();
      out.push({ type: "hardBreak" });
      i++;
    } else if (src.startsWith("***", i) && findClose(src, "***", i + 3) > i + 3) {
      const end = findClose(src, "***", i + 3);
      flush();
      out.push(...scan(src.slice(i + 3, end), [...marks, { type: "bold" }, { type: "italic" }]));
      i = end + 3;
    } else if (src.startsWith("**", i) && findClose(src, "**", i + 2) > i + 2) {
      const end = findClose(src, "**", i + 2);
      flush();
      out.push(...scan(src.slice(i + 2, end), [...marks, { type: "bold" }]));
      i = end + 2;
    } else if (c === "*" && findClose(src, "*", i + 1) > i + 1) {
      const end = findClose(src, "*", i + 1);
      flush();
      out.push(...scan(src.slice(i + 1, end), [...marks, { type: "italic" }]));
      i = end + 1;
    } else if (c === "[" && matchLink(src, i)) {
      const link = matchLink(src, i)!;
      flush();
      out.push(...scan(link.label, [...marks, { type: "link", attrs: { href: link.href } }]));
      i = link.end;
    } else {
      buf += c;
      i++;
    }
  }
  flush();
  return out;
}

export function parseInline(text: string): Inline[] {
  return scan(text, []);
}

/** Markup for TipTap inline content, or null when it holds something the markup cannot express. */
export function serializeInline(content: Node[] | undefined): string | null {
  let out = "";
  for (const n of content ?? []) {
    if (n.type === "hardBreak") {
      out += "\n";
      continue;
    }
    if (n.type !== "text" || typeof n.text !== "string") return null;
    let s = escapeInline(n.text);
    const marks = n.marks ?? [];
    if (marks.some((m) => m.type !== "bold" && m.type !== "italic" && m.type !== "link")) return null;
    if (marks.some((m) => m.type === "italic")) s = `*${s}*`;
    if (marks.some((m) => m.type === "bold")) s = `**${s}**`;
    const link = marks.find((m) => m.type === "link");
    if (link) {
      const href = link.attrs?.href;
      if (typeof href !== "string" || !LINK.test(href)) return null;
      s = `[${s}](${href})`;
    }
    out += s;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Document -> sections
// ---------------------------------------------------------------------------
const RAW_LABELS: Record<string, string> = {
  table: "Table",
  horizontalRule: "Divider",
  codeBlock: "Code block",
  bulletList: "List",
  orderedList: "List",
  blockquote: "Quote",
  heading: "Heading",
  paragraph: "Paragraph",
};

const raw = (id: string, node: Node): Section => ({ id, kind: "raw", node, label: RAW_LABELS[node.type] ?? node.type });

function paragraphsText(nodes: Node[] | undefined): string | null {
  const parts: string[] = [];
  for (const p of nodes ?? []) {
    if (p.type !== "paragraph") return null;
    const t = serializeInline(p.content);
    if (t === null) return null;
    parts.push(t);
  }
  return parts.join("\n\n");
}

function listText(node: Node): string | null {
  const lines: string[] = [];
  for (const item of node.content ?? []) {
    const only = item.content?.length === 1 && item.content[0]?.type === "paragraph" ? item.content[0] : null;
    if (item.type !== "listItem" || !only) return null;
    const t = serializeInline(only.content);
    if (t === null || t.includes("\n")) return null;
    lines.push(t);
  }
  return lines.join("\n");
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Canonical shape of a node for comparing "what was stored" with "what the editor would write back". */
function canon(n: Node): unknown {
  if (n.type === "text") return { t: n.text ?? "", m: (n.marks ?? []).map((m) => (m.type === "link" ? `link:${String(m.attrs?.href)}` : m.type)).sort() };
  if (n.type === "youtube") return { type: "youtube", src: n.attrs?.src ?? null };
  const attrs = Object.fromEntries(Object.entries(n.attrs ?? {}).filter(([k, v]) => v !== null && v !== undefined && v !== "" && !(k === "start" && v === 1)));
  const content: unknown[] = [];
  for (const child of n.content ?? []) {
    const c = canon(child) as { t?: string; m?: string[] };
    const prev = content[content.length - 1] as { t?: string; m?: string[] } | undefined;
    if (c.t !== undefined && prev?.t !== undefined && JSON.stringify(prev.m) === JSON.stringify(c.m)) prev.t += c.t;
    else content.push(c);
  }
  return { type: n.type, attrs, content };
}

/** True when turning `section` back into a document gives back `node`: nothing the editor would drop or change. */
function survives(section: Section, node: Node): boolean {
  if ((node.type === "paragraph" || node.type === "heading") && !node.content?.length) return true; // a blank line carries no content
  return JSON.stringify(toNodes(section).map(canon)) === JSON.stringify([node].map(canon));
}

export function docToSections(doc: unknown): Section[] {
  const nodes = ((doc as { content?: Node[] } | null)?.content ?? []) as Node[];
  return nodes.map((node, i) => {
    const section = convertNode(node, i);
    // Lossless or untouched: anything the editor cannot write back exactly (nested bold + italic, ordered-list start,
    // double line breaks …) stays a "kept as written" section, so opening and saving never changes an old article.
    return section.kind === "raw" || survives(section, node) ? section : raw(section.id, node);
  });
}

function convertNode(node: Node, i: number): Section {
  const id = `s${i}`;
  switch (node.type) {
    case "heading": {
      const level = node.attrs?.level;
      const text = serializeInline(node.content);
      return text === null || (level !== 2 && level !== 3 && level !== 4) ? raw(id, node) : { id, kind: "heading", level, text };
    }
    case "paragraph": {
      const text = serializeInline(node.content);
      return text === null ? raw(id, node) : { id, kind: "paragraph", text };
    }
    case "figure":
      return {
        id,
        kind: "image",
        mediaId: typeof node.attrs?.mediaId === "string" ? node.attrs.mediaId : null,
        src: str(node.attrs?.src),
        alt: str(node.attrs?.alt),
        caption: str(node.attrs?.caption),
        credit: str(node.attrs?.credit),
      };
    case "blockquote": {
      const text = paragraphsText(node.content);
      return text === null ? raw(id, node) : { id, kind: "quote", text, pull: node.attrs?.variant === "pull" };
    }
    case "bulletList":
    case "orderedList": {
      const text = listText(node);
      return text === null ? raw(id, node) : { id, kind: "list", ordered: node.type === "orderedList", text };
    }
    case "youtube":
      return typeof node.attrs?.src === "string" && isEmbedUrl(node.attrs.src) ? { id, kind: "embed", url: node.attrs.src } : raw(id, node);
    default:
      return raw(id, node);
  }
}

// ---------------------------------------------------------------------------
// Sections -> document
// ---------------------------------------------------------------------------
const chunks = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

const paragraph = (text: string): Node => ({ type: "paragraph", content: parseInline(text) as Node[] });

function toNodes(s: Section): Node[] {
  switch (s.kind) {
    case "heading": {
      const text = s.text.replace(/\s*\n\s*/g, " ").trim();
      return text ? [{ type: "heading", attrs: { level: s.level }, content: parseInline(text) as Node[] }] : [];
    }
    case "paragraph":
      return chunks(s.text).map(paragraph);
    case "image":
      return s.src ? [{ type: "figure", attrs: { src: s.src, alt: s.alt, caption: s.caption, credit: s.credit, mediaId: s.mediaId } }] : [];
    case "quote": {
      const paras = chunks(s.text).map(paragraph);
      return paras.length ? [{ type: "blockquote", attrs: { variant: s.pull ? "pull" : null }, content: paras }] : [];
    }
    case "list": {
      const items = s.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l): Node => ({ type: "listItem", content: [paragraph(l)] }));
      return items.length ? [{ type: s.ordered ? "orderedList" : "bulletList", content: items }] : [];
    }
    case "embed":
      return isEmbedUrl(s.url) ? [{ type: "youtube", attrs: { src: s.url.trim() } }] : [];
    case "raw":
      return [s.node as Node];
  }
}

export function sectionsToDoc(sections: readonly Section[]): { type: "doc"; content: Node[] } {
  return { type: "doc", content: sections.flatMap(toNodes) };
}

// ---------------------------------------------------------------------------
// Checks the editor shows next to the Publish button
// ---------------------------------------------------------------------------
/** The server's body rule: the article needs some text (a lone image or video does not count). */
export function hasBodyText(sections: readonly Section[]): boolean {
  return sections.some((s) => {
    switch (s.kind) {
      case "heading":
      case "paragraph":
      case "quote":
      case "list":
        return s.text.trim() !== "";
      case "image":
        return s.caption.trim() !== "";
      case "embed":
        return false;
      case "raw":
        return true;
    }
  });
}

/** Problems inside individual sections, one message each, e.g. an Image section without an image. */
export function sectionProblems(sections: readonly Section[]): { sectionId: string; message: string }[] {
  const out: { sectionId: string; message: string }[] = [];
  const counts: Partial<Record<Section["kind"], number>> = {};
  for (const s of sections) {
    counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    const nth = `${SECTION_LABELS[s.kind]} section ${counts[s.kind]}`;
    if (s.kind === "image" && !s.src) out.push({ sectionId: s.id, message: `${nth}: choose an image or remove the section.` });
    if (s.kind === "embed" && !isEmbedUrl(s.url)) out.push({ sectionId: s.id, message: `${nth}: paste a YouTube link (https://…) or remove the section.` });
  }
  return out;
}
