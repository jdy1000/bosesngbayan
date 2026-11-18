import { describe, expect, it } from "vitest";
import { splitAfterParagraph } from "@/lib/rich-text/split";

const p = (t: string) => `<p>${t}</p>`;

describe("splitAfterParagraph", () => {
  it("splits right after the n-th top-level paragraph", () => {
    const html = p("a") + p("b") + p("c") + p("d");
    expect(splitAfterParagraph(html, 3)).toEqual([p("a") + p("b") + p("c"), p("d")]);
  });

  it("counts headings and figures between paragraphs only as content, not as paragraphs", () => {
    const html = p("a") + "<h2>Head</h2>" + p("b") + '<figure data-figure><img src="https://x/y.jpg" alt=""></figure>' + p("c") + p("d");
    const [head, tail] = splitAfterParagraph(html, 3)!;
    expect(head.endsWith(p("c"))).toBe(true);
    expect(tail).toBe(p("d"));
  });

  it("does not count paragraphs inside quotes or lists", () => {
    const html = p("a") + "<blockquote><p>q1</p><p>q2</p></blockquote>" + "<ul><li><p>i1</p></li></ul>" + p("b") + p("c") + p("d");
    const [head, tail] = splitAfterParagraph(html, 3)!;
    expect(head.endsWith(p("c"))).toBe(true);
    expect(tail).toBe(p("d"));
  });

  it("ignores void tags and self-closing breaks inside a paragraph", () => {
    const html = "<p>a<br>b<br/>c</p>" + p("b") + p("c") + p("d");
    expect(splitAfterParagraph(html, 3)![1]).toBe(p("d"));
  });

  it("returns null when the story is too short or nothing follows the n-th paragraph", () => {
    expect(splitAfterParagraph(p("a") + p("b"), 3)).toBeNull();
    expect(splitAfterParagraph(p("a") + p("b") + p("c"), 3)).toBeNull();
    expect(splitAfterParagraph(p("a") + p("b") + p("c") + "  \n", 3)).toBeNull();
    expect(splitAfterParagraph("", 3)).toBeNull();
  });
});
