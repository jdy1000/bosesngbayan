import type { ArticleStatus } from "@/lib/studio/articles";

export interface WorkflowPerms {
  submit: boolean;
  review: boolean;
  publish: boolean;
  archive: boolean;
  editAny: boolean;
}

export type WorkflowAction = { to: ArticleStatus; label: string; input?: "reason" | "note" | "schedule"; tone?: "primary" | "danger"; confirm?: string };

/** UX only: offer the transitions transition_article() would plausibly accept. The DB decides. */
export function availableActions(status: ArticleStatus, p: WorkflowPerms, isAuthor: boolean): WorkflowAction[] {
  const a: WorkflowAction[] = [];
  const canSubmit = p.submit && (isAuthor || p.editAny);
  const publishNow: WorkflowAction = { to: "published", label: "Publish now", tone: "primary", confirm: "Publish this article now?" };
  const schedule: WorkflowAction = { to: "scheduled", label: "Schedule", input: "schedule" };
  switch (status) {
    case "draft":
      if (canSubmit) a.push({ to: "pending_review", label: "Submit for review", tone: "primary" });
      if (p.publish) a.push(publishNow, schedule);
      break;
    case "rejected":
      if (canSubmit) a.push({ to: "pending_review", label: "Resubmit", tone: "primary" });
      if (isAuthor || p.editAny) a.push({ to: "draft", label: "Return to draft" });
      break;
    case "pending_review":
      if (p.review) a.push({ to: "approved", label: "Approve", input: "note", tone: "primary" }, { to: "rejected", label: "Reject", input: "reason", tone: "danger" });
      if ((isAuthor && p.submit) || p.review) a.push({ to: "draft", label: "Withdraw to draft" });
      break;
    case "approved":
      if (p.publish) a.push(publishNow, schedule);
      if (p.review || p.publish) a.push({ to: "draft", label: "Return to draft" });
      break;
    case "scheduled":
      if (p.publish) a.push(publishNow, { to: "draft", label: "Cancel schedule" });
      break;
    case "published":
      if (p.publish) a.push({ to: "draft", label: "Unpublish", tone: "danger", confirm: "This removes it from the public site. Continue?" });
      break;
    case "archived":
      if (p.archive) a.push({ to: "draft", label: "Restore as draft", tone: "primary" });
      break;
  }
  if (status !== "archived" && p.archive) a.push({ to: "archived", label: "Archive", confirm: "Archive this article? It will be removed from the public site if published." });
  return a;
}
