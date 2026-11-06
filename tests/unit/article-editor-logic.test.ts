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
  tag_ids: "[]",
  related_ids: "[]",
  contributors: "[]",
};

describe("articleFormSchema", () => {
  it("normalizes blanks to null and accepts a minimal draft", () => {
    const r = articleFormSchema.parse(base);
    expect(r.subtitle).toBeNull();
    expect(r.category_id).toBeNull();
    expect(r.tag_ids).toEqual([]);
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

  it("dedupes tag ids and rejects malformed JSON", () => {
    const t = "6f1c2f9e-0c1a-4d5b-9a8e-1b2c3d4e5f61";
    expect(articleFormSchema.parse({ ...base, tag_ids: JSON.stringify([t, t]) }).tag_ids).toEqual([t]);
    expect(articleFormSchema.safeParse({ ...base, tag_ids: "not json" }).success).toBe(false);
  });
});

const none: WorkflowPerms = { submit: false, review: false, publish: false, archive: false, editAny: false };
const writer: WorkflowPerms = { ...none, submit: true };
const editor: WorkflowPerms = { submit: true, review: true, publish: true, archive: true, editAny: true };
const targets = (a: { to: string }[]) => a.map((x) => x.to);

describe("availableActions (UX mirror of transition_article)", () => {
  it("writer can only submit own drafts and never publish", () => {
    expect(targets(availableActions("draft", writer, true))).toEqual(["pending_review"]);
    expect(availableActions("draft", writer, false)).toEqual([]);
    expect(targets(availableActions("pending_review", writer, true))).toEqual(["draft"]);
    expect(availableActions("approved", writer, true)).toEqual([]);
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
