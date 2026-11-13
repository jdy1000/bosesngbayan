/**
 * Permission keys. Mirrors public.permissions (migration 20261106000100). The database is the
 * authority — this list exists for type safety and for deciding which controls to render.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "articles.create",
  "articles.edit_own",
  "articles.edit_any",
  "articles.view_all",
  "articles.submit",
  "articles.review",
  "articles.publish",
  "articles.archive",
  "articles.delete",
  "media.upload",
  "media.manage_any",
  "taxonomy.manage",
  "pages.manage",
  "homepage.manage",
  "navigation.manage",
  "polls.manage",
  "polls.view_results",
  "moderation.manage",
  "tips.manage",
  "newsletter.view",
  "newsletter.manage",
  "analytics.view",
  "users.view",
  "users.manage",
  "settings.manage",
  "seo.manage",
  "ads.manage",
  "audit.view",
  "roles.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["owner", "administrator", "editor", "writer", "moderator", "analyst"] as const;
export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  administrator: "Administrator",
  editor: "Editor",
  writer: "Writer",
  moderator: "Moderator",
  analyst: "Analyst",
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
