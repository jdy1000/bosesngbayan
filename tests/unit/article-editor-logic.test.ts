import { describe, expect, it } from "vitest";
import { articleFormSchema } from "@/app/admin/(studio)/articles/schema";
import { availableActions, type WorkflowPerms } from "@/app/admin/(studio)/articles/_components/workflow";

const base = {
  title: "Bagong balita",
  subtitle: "",
  slug: "bagong-balita",
  excerpt: "",
  body: '{"type":"doc","content":[]}',
  category_id: "",
  location_id: "",
  featured_image_id: "",
  og_image_id: "",
  seo_title: "",
  seo_description: "",
  canonical_url: "",
  source_attribution: "",
  correction_note: "",
  tags_text: "",
  related_ids: "[]",
  contributors: "[]",
};

describe("articleFormSchema", () => {
  it("normalizes blanks to null and accepts a minimal draft", () => {
    const r = articleFormSchema.parse(base);
    expect(r.subtitle).toBeNull();
    expect(r.category_id).toBeNull();
    expect(r.tags_text).toEqual([]);
  });

  it("rejects invalid slugs, non-https canonical URLs and duplicate contributors", () => {
    expect(articleFormSchema.safeParse({ ...base, slug: "May Space" }).success).toBe(false);
    expect(articleFormSchema.safeParse({ ...base, canonical_url: "http://example.com/a" }).success).toBe(false);
    expect(articleFormSchema.safeParse({ ...base, canonical_url: "javascript:alert(1)" }).success).toBe(false);
    const p = "6f1c2f9e-0c1a-4d5b-9a8e-1b2c3d4e5f60";
    const dup = JSON.stringify([
      { profile_id: p, role_label: "Litratista" },
      { profile_id: p, role_label: "Editor" },
    ]);
    expect(articleFormSchema.safeParse({ ...base, contributors: dup }).success).toBe(false);
  });

  it("reads tags typed as a comma-separated list: trimmed, no blanks, no repeats", () => {
    expect(articleFormSchema.parse({ ...base, tags_text: " Design, culture ,, #Manila, DESIGN \n Culture" }).tags_text).toEqual(["Design", "culture", "Manila"]);
  });

  it("refuses too many tags and over-long tags", () => {
    const many = Array.from({ length: 21 }, (_, i) => `tag${i}`).join(",");
    expect(articleFormSchema.safeParse({ ...base, tags_text: many }).success).toBe(false);
    expect(articleFormSchema.safeParse({ ...base, tags_text: "x".repeat(61) }).success).toBe(false);
  });
});

const none: WorkflowPerms = { submit: false, review: false, publish: false, archive: false, editAny: false };
const writer: WorkflowPerms = { ...none, submit: true };
const author: WorkflowPerms = { ...none, submit: true, publish: true };
const editor: WorkflowPerms = { submit: true, review: true, publish: true, archive: true, editAny: true };
const targets = (a: { to: string }[]) => a.map((x) => x.to);

describe("availableActions (UX mirror of transition_article)", () => {
  it("an author without publish permission can only submit own drafts", () => {
    expect(targets(availableActions("draft", writer, true))).toEqual(["pending_review"]);
    expect(availableActions("draft", writer, false)).toEqual([]);
    expect(targets(availableActions("pending_review", writer, true))).toEqual(["draft"]);
    expect(availableActions("approved", writer, true)).toEqual([]);
  });

  it("an author with publish permission can publish, schedule and unpublish own stories without a review", () => {
    expect(targets(availableActions("draft", author, true))).toEqual(["pending_review", "published", "scheduled"]);
    expect(targets(availableActions("published", author, true))).toEqual(["draft"]);
    expect(availableActions("pending_review", author, true).map((a) => a.to)).toEqual(["draft"]);
  });

  it("editor sees review, publish, schedule, unpublish and archive paths", () => {
    expect(targets(availableActions("pending_review", editor, false))).toEqual(["approved", "rejected", "draft", "archived"]);
    expect(targets(availableActions("approved", editor, false))).toEqual(["published", "scheduled", "draft", "archived"]);
    expect(targets(availableActions("published", editor, false))).toEqual(["draft", "archived"]);
    expect(targets(availableActions("archived", editor, false))).toEqual(["draft"]);
  });

  it("reject requires a reason input and schedule a datetime input", () => {
    const pr = availableActions("pending_review", editor, false);
    expect(pr.find((a) => a.to === "rejected")?.input).toBe("reason");
    expect(availableActions("draft", editor, false).find((a) => a.to === "scheduled")?.input).toBe("schedule");
  });
});
