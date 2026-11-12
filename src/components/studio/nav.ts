import type { Permission } from "@/lib/auth/permissions";

export interface StudioNavItem {
  href: string;
  label: string;
  icon: StudioIcon;
  /** Shown when the user has ANY of these (empty = everyone). UX only — every page and action re-checks on the server. */
  anyOf: Permission[];
}

export type StudioIcon =
  | "overview" | "analytics" | "articles" | "review" | "reports" | "ads" | "audience" | "users"
  | "applications" | "categories" | "settings" | "create" | "account";

/** Flat list in the order of the Newsmaker console (ADR-016), plus Analytics and Settings. */
export const STUDIO_NAV: StudioNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", anyOf: ["dashboard.view"] },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", anyOf: ["analytics.view"] },
  { href: "/admin/articles", label: "Articles", icon: "articles", anyOf: ["articles.create", "articles.view_all"] },
  { href: "/admin/review", label: "Review queue", icon: "review", anyOf: ["articles.review"] },
  { href: "/admin/moderation", label: "Reports", icon: "reports", anyOf: ["moderation.manage"] },
  { href: "/admin/ads", label: "Ad inventory", icon: "ads", anyOf: ["ads.manage"] },
  { href: "/admin/newsletter", label: "Audience", icon: "audience", anyOf: ["newsletter.view", "newsletter.manage"] },
  { href: "/admin/team", label: "Users & roles", icon: "users", anyOf: ["users.view", "users.manage"] },
  { href: "/admin/applications", label: "Applications", icon: "applications", anyOf: ["users.manage"] },
  { href: "/admin/taxonomy", label: "Site categories", icon: "categories", anyOf: ["taxonomy.manage"] },
  { href: "/admin/settings", label: "Settings", icon: "settings", anyOf: ["settings.manage"] },
  { href: "/admin/articles/new", label: "Create article", icon: "create", anyOf: ["articles.create"] },
  // Empty anyOf = every signed-in staff member (own account only; enforced in the account actions).
  { href: "/admin/account", label: "My account", icon: "account", anyOf: [] },
];

/** The nav item that owns `path`: the longest matching href. */
export function findNavItem(path: string): StudioNavItem | null {
  let best: StudioNavItem | null = null;
  for (const item of STUDIO_NAV) {
    const owns = path === item.href || path.startsWith(`${item.href}/`);
    if (owns && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}
