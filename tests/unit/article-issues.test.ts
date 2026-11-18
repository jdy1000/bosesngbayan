import { describe, expect, it } from "vitest";
import { articleIssues, issuesFor } from "@/app/admin/(studio)/articles/_components/article-issues";
import type { Section } from "@/lib/rich-text/sections";

const ready = {
  title: "Bagong balita",
  slug: "bagong-balita",
  categoryId: "6f1c2f9e-0c1a-4d5b-9a8e-1b2c3d4e5f60",
  sections: [{ id: "a", kind: "paragraph", text: "Isang talata." }] as Section[],
  hasThumbnail: true,
};
const ids = (input: Parameters<typeof articleIssues>[0]) => articleIssues(input).map((i) => i.id);

describe("articleIssues: why an article cannot go out", () => {
  it("is empty for a complete article", () => {
    expect(articleIssues(ready)).toEqual([]);
  });

  it("lists every missing piece of a blank new article, in the order a writer fixes them", () => {
    const blank = { title: "", slug: "", categoryId: "", sections: [{ id: "s0", kind: "paragraph", text: "" }] as Section[], hasThumbnail: false };
    expect(ids(blank)).toEqual(["title", "category", "body", "slug", "thumbnail"]);
  });

  it("points at the section that is wrong", () => {
    const sections: Section[] = [
      ...ready.sections,
      { id: "img", kind: "image", mediaId: null, src: "", alt: "", caption: "", credit: "" },
    ];
    const [issue] = articleIssues({ ...ready, sections });
    expect(issue).toMatchObject({ id: "img", target: "section-img", needs: "submit" });
  });

  it("a bad slug is reported", () => {
    expect(ids({ ...ready, slug: "May Space" })).toEqual(["slug"]);
  });

  it("a missing thumbnail stops publishing and scheduling but not review", () => {
    const issues = articleIssues({ ...ready, hasThumbnail: false });
    expect(issuesFor("published", issues).map((i) => i.id)).toEqual(["thumbnail"]);
    expect(issuesFor("scheduled", issues).map((i) => i.id)).toEqual(["thumbnail"]);
    expect(issuesFor("pending_review", issues)).toEqual([]);
    expect(issuesFor("draft", issues)).toEqual([]);
  });
});
