import { describe, expect, it } from "vitest";
import {
  docToSections,
  hasBodyText,
  isEmbedUrl,
  parseInline,
  sectionProblems,
  sectionsToDoc,
  serializeInline,
  type Section,
} from "@/lib/rich-text/sections";

const text = (t: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => (marks ? { type: "text", text: t, marks } : { type: "text", text: t });

describe("inline markup", () => {
  it.each([
    "plain words",
    "a **bold** and *italic* word",
    "see [the report](https://example.com/a?b=1) now",
    "[**bold link**](https://example.com)", // canonical order: link outside, then bold, then italic
    "line one\nline two",
    "stars \\* and \\[brackets\\] and \\\\ slash",
  ])("round-trips %j", (source) => {
    expect(serializeInline(parseInline(source) as never)).toBe(source);
  });

  it("keeps an unclosed marker as text instead of swallowing the rest", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([text("2 * 3 = 6")]);
    expect(parseInline("a **b")).toEqual([text("a **b")]);
  });

  it("does not turn a non-http link into a link", () => {
    const nodes = parseInline("[click](javascript:alert(1))");
    expect(JSON.stringify(nodes)).not.toContain('"link"');
  });

  it("refuses to flatten formatting it cannot express", () => {
    expect(serializeInline([text("u", [{ type: "underline" }])] as never)).toBeNull();
    expect(serializeInline([text("c", [{ type: "code" }])] as never)).toBeNull();
  });
});

describe("document <-> sections", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [text("Headline")] },
      { type: "paragraph", content: [text("Hello "), text("world", [{ type: "bold" }]), { type: "hardBreak" }, text("next")] },
      { type: "figure", attrs: { src: "https://x.test/a.jpg", alt: "A", caption: "Cap", credit: "Me", mediaId: "11111111-1111-4111-8111-111111111111" } },
      { type: "blockquote", attrs: { variant: "pull" }, content: [{ type: "paragraph", content: [text("Quoted")] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("one")] }] }, { type: "listItem", content: [{ type: "paragraph", content: [text("two")] }] }] },
      { type: "youtube", attrs: { src: "https://www.youtube.com/watch?v=abcdefghijk" } },
      { type: "horizontalRule" },
      { type: "table", content: [] },
    ],
  };

  it("maps each node to its section and keeps what it cannot edit", () => {
    const s = docToSections(doc);
    expect(s.map((x) => x.kind)).toEqual(["heading", "paragraph", "image", "quote", "list", "embed", "raw", "raw"]);
    expect(s[1]).toMatchObject({ text: "Hello **world**\nnext" });
    expect(s[3]).toMatchObject({ pull: true });
  });

  it("writes back the same document", () => {
    expect(sectionsToDoc(docToSections(doc))).toEqual(doc);
  });

  it("keeps a paragraph with underline as a raw section so the formatting is not lost", () => {
    const d = { type: "doc", content: [{ type: "paragraph", content: [text("keep", [{ type: "underline" }])] }] };
    const s = docToSections(d);
    expect(s[0]?.kind).toBe("raw");
    expect(sectionsToDoc(s)).toEqual(d);
  });

  it("drops empty sections and splits blank lines into paragraphs", () => {
    const sections: Section[] = [
      { id: "a", kind: "paragraph", text: "   " },
      { id: "b", kind: "paragraph", text: "first\n\nsecond" },
      { id: "c", kind: "heading", level: 2, text: "" },
      { id: "d", kind: "embed", url: "not a link" },
      { id: "e", kind: "image", mediaId: null, src: "", alt: "", caption: "", credit: "" },
    ];
    expect(sectionsToDoc(sections).content.map((n) => n.type)).toEqual(["paragraph", "paragraph"]);
  });
});

describe("checks shown beside the Publish button", () => {
  it("needs text in the body: an image or video alone does not count", () => {
    expect(hasBodyText([{ id: "a", kind: "paragraph", text: " " }])).toBe(false);
    expect(hasBodyText([{ id: "a", kind: "embed", url: "https://youtu.be/abcdefghijk" }])).toBe(false);
    expect(hasBodyText([{ id: "a", kind: "image", mediaId: null, src: "https://x/y.jpg", alt: "", caption: "", credit: "" }])).toBe(false);
    expect(hasBodyText([{ id: "a", kind: "paragraph", text: "Hi" }])).toBe(true);
  });

  it("names the section that has a problem", () => {
    const problems = sectionProblems([
      { id: "p", kind: "paragraph", text: "ok" },
      { id: "i", kind: "image", mediaId: null, src: "", alt: "", caption: "", credit: "" },
      { id: "e", kind: "embed", url: "http://youtube.com/watch?v=x" },
    ]);
    expect(problems).toEqual([
      { sectionId: "i", message: "Image section 1: choose an image or remove the section." },
      { sectionId: "e", message: "Embed section 1: paste a YouTube link (https://…) or remove the section." },
    ]);
  });

  it("accepts only https YouTube links for embeds", () => {
    expect(isEmbedUrl("https://www.youtube.com/watch?v=abcdefghijk")).toBe(true);
    expect(isEmbedUrl("https://youtu.be/abcdefghijk")).toBe(true);
    expect(isEmbedUrl("http://youtu.be/abcdefghijk")).toBe(false);
    expect(isEmbedUrl("https://evil.example/watch?v=abc")).toBe(false);
  });
});

describe("opening an old article never changes it (lossless or kept as written)", () => {
  const p = (...content: unknown[]) => ({ type: "doc", content: [{ type: "paragraph", content }] });
  const bold = { type: "bold" };
  const italic = { type: "italic" };

  it("bold and italic on the same words survive", () => {
    const d = p(text("hello "), text("both", [bold, italic]), text(" end"));
    const s = docToSections(d);
    expect(s[0]).toMatchObject({ kind: "paragraph", text: "hello ***both*** end" });
    expect(sectionsToDoc(s).content[0]).toMatchObject({ content: [text("hello "), text("both", [bold, italic]), text(" end")] });
  });

  it("tangled formatting either round-trips exactly or stays untouched, never corrupted", () => {
    const flat = (d: { content: { content?: { text?: string; marks?: { type: string }[] }[] }[] }) =>
      d.content.flatMap((n) => (n.content ?? []).map((t) => `${t.text}|${(t.marks ?? []).map((m) => m.type).sort().join("+")}`));
    const docs = [
      p(text("a ", [bold]), text("b", [bold, italic]), text(" c", [bold])),
      p(text("x ", [italic]), text("y", [bold, italic]), text(" z", [italic])),
      p(text("*stars* and **more**"), text(" *", [bold])),
    ];
    for (const d of docs) {
      const back = sectionsToDoc(docToSections(d)) as never;
      // Same words with the same marks, in the same order (adjacent equal runs may merge).
      const merge = (xs: string[]) => xs.reduce<string[]>((acc, x) => {
        const [t, m] = x.split("|");
        const last = acc[acc.length - 1]?.split("|");
        if (last && last[1] === m) acc[acc.length - 1] = `${last[0]}${t}|${m}`;
        else acc.push(x);
        return acc;
      }, []);
      expect(merge(flat(back))).toEqual(merge(flat(d as never)));
    }
  });

  it("a link as the rich editor stored it (target and rel attributes) is still an editable paragraph", () => {
    const link = { type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer nofollow", class: null } };
    const s = docToSections(p(text("see "), text("this", [link])));
    expect(s[0]).toMatchObject({ kind: "paragraph", text: "see [this](https://example.com)" });
  });

  it("a numbered list that starts at 3, and a double line break, are kept as written", () => {
    const list = { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("x")] }] }] };
    expect(docToSections({ type: "doc", content: [list] })[0]?.kind).toBe("raw");
    expect(docToSections(p(text("a"), { type: "hardBreak" }, { type: "hardBreak" }, text("b")))[0]?.kind).toBe("raw");
  });

  it("an embed keeps working when TipTap stored size attributes beside the link", () => {
    const yt = { type: "youtube", attrs: { src: "https://www.youtube-nocookie.com/embed/abcdefghijk", start: 0, width: 640, height: 480 } };
    expect(docToSections({ type: "doc", content: [yt] })[0]).toMatchObject({ kind: "embed" });
  });

  it("a blank paragraph is an empty paragraph section, not a locked one", () => {
    expect(docToSections({ type: "doc", content: [{ type: "paragraph" }] })[0]).toMatchObject({ kind: "paragraph", text: "" });
  });
});
