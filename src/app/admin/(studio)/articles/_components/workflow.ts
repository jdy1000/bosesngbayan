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
  const publishNow: WorkflowAction = { to: "published", label: "I-publish ngayon", tone: "primary", confirm: "I-publish ang artikulong ito ngayon?" };
  const schedule: WorkflowAction = { to: "scheduled", label: "I-iskedyul", input: "schedule" };
  switch (status) {
    case "draft":
      if (canSubmit) a.push({ to: "pending_review", label: "Isumite para sa review", tone: "primary" });
      if (p.publish) a.push(publishNow, schedule);
      break;
    case "rejected":
      if (canSubmit) a.push({ to: "pending_review", label: "Isumiteng muli", tone: "primary" });
      if (isAuthor || p.editAny) a.push({ to: "draft", label: "Ibalik sa draft" });
      break;
    case "pending_review":
      if (p.review) a.push({ to: "approved", label: "Aprubahan", input: "note", tone: "primary" }, { to: "rejected", label: "I-reject", input: "reason", tone: "danger" });
      if ((isAuthor && p.submit) || p.review) a.push({ to: "draft", label: "Bawiin sa draft" });
      break;
    case "approved":
      if (p.publish) a.push(publishNow, schedule);
      if (p.review || p.publish) a.push({ to: "draft", label: "Ibalik sa draft" });
      break;
    case "scheduled":
      if (p.publish) a.push(publishNow, { to: "draft", label: "Kanselahin ang iskedyul" });
      break;
    case "published":
      if (p.publish) a.push({ to: "draft", label: "I-unpublish", tone: "danger", confirm: "Aalisin ito sa publikong site. Ituloy?" });
      break;
    case "archived":
      if (p.archive) a.push({ to: "draft", label: "I-restore bilang draft", tone: "primary" });
      break;
  }
  if (status !== "archived" && p.archive) a.push({ to: "archived", label: "I-archive", confirm: "I-archive ang artikulong ito? Aalisin ito sa publiko kung nakalathala." });
  return a;
}
