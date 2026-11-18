import { isValidSlug } from "@/lib/format";
import { hasBodyText, sectionProblems, type Section } from "@/lib/rich-text/sections";

/**
 * Why an article cannot be submitted or published yet, in the words shown beside the Publish button.
 * `needs` says which actions the problem stops: "submit" = every step beyond saving a draft (review, publish,
 * schedule); "publish" = publishing and scheduling only. These mirror what transition_article() and the
 * transition action enforce, so the list the writer sees is the list the server would refuse with.
 */
export interface ArticleIssue {
  id: string;
  message: string;
  /** DOM id to scroll to and focus when the writer clicks the problem. */
  target: string;
  needs: "submit" | "publish";
}

export function articleIssues(input: { title: string; slug: string; categoryId: string; sections: readonly Section[]; hasThumbnail: boolean }): ArticleIssue[] {
  const out: ArticleIssue[] = [];
  if (!input.title.trim()) out.push({ id: "title", message: "Add a headline in the Title field.", target: "title", needs: "submit" });
  if (!input.categoryId) out.push({ id: "category", message: "Choose a category in Story settings.", target: "category_id", needs: "submit" });
  if (!hasBodyText(input.sections)) {
    out.push({ id: "body", message: "Write some text in the body: an image or video alone is not enough.", target: "body-panel", needs: "submit" });
  }
  for (const p of sectionProblems(input.sections)) out.push({ id: p.sectionId, message: p.message, target: `section-${p.sectionId}`, needs: "submit" });
  if (!isValidSlug(input.slug)) {
    out.push({ id: "slug", message: "The URL slug is empty or has characters other than lowercase letters, numbers and hyphens.", target: "slug", needs: "submit" });
  }
  if (!input.hasThumbnail) out.push({ id: "thumbnail", message: "Add a thumbnail image in Story settings: it is the picture on story cards and shared links.", target: "thumbnail-panel", needs: "publish" });
  return out;
}

/** Problems that stop `to` (a target status) from being reached. Saving a draft is never blocked here. */
export function issuesFor(to: string, issues: readonly ArticleIssue[]): ArticleIssue[] {
  if (to === "pending_review") return issues.filter((i) => i.needs === "submit");
  if (to === "published" || to === "scheduled") return [...issues];
  return [];
}
