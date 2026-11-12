import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import { adStatus } from "@/lib/studio/ads";
import { loadAnalyticsSummary, type AnalyticsSummary } from "@/lib/studio/analytics";
import { fillDays, parseRange, type DateRange } from "@/lib/studio/range";
import type { Permission } from "@/lib/auth/permissions";
import type { Database } from "@/lib/database.types";

type ArticleStatus = Database["public"]["Enums"]["article_status"];
export const DASHBOARD_STATUSES: ArticleStatus[] = ["draft", "pending_review", "approved", "rejected", "scheduled", "published", "archived"];

/** Row cap for in-range scans (publication activity, active writers). Plenty for a newsroom. */
const SCAN_LIMIT = 5000;

const manilaDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

export interface ActivityItem {
  id: number;
  at: string;
  actor: string | null;
  entityType: string;
  entityId: string;
  title: string | null;
  action: string;
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface RecentArticle {
  id: string;
  title: string;
  status: ArticleStatus;
  updatedAt: string;
  category: string | null;
}

export interface DashboardData {
  /** False when RLS limits the article counts to the viewer's own work. */
  allArticles: boolean;
  /** The six articles changed last: everyone's for holders of articles.view_all, otherwise the viewer's own. */
  recent: RecentArticle[];
  /** Staff accounts (profiles with a role). Null without users.view. */
  team: { total: number; active: number } | null;
  /** Reader reports still open. Null without moderation.manage. */
  openReports: number | null;
  /** Ads that are on and inside their date window. Null without ads.manage. */
  activeAds: number | null;
  statusCounts: Record<ArticleStatus, number>;
  totalArticles: number;
  publishedToday: number;
  publicationByDay: { day: string; articles: number }[];
  publishedInRange: number;
  activeWriters: number;
  scanTruncated: boolean;
  activity: ActivityItem[];
  analytics: AnalyticsSummary | null;
  analyticsError: boolean;
  polls: { active: number; ballotsAllTime: number | null } | null;
  newsletter: { subscribed: number; newInRange: number } | null;
}

function count(res: { count: number | null; error: unknown }): number {
  if (res.error) throw res.error;
  return res.count ?? 0;
}

export async function loadDashboard(ctx: StaffContext, range: DateRange): Promise<DashboardData> {
  const db = ctx.supabase;
  const has = (p: Permission) => ctx.permissions.has(p);
  const today = parseRange({ range: "today" });
  const head = { count: "exact" as const, head: true };

  const statusPromise = Promise.all(
    DASHBOARD_STATUSES.map(async (s) => [s, count(await db.from("articles").select("id", head).eq("status", s))] as const),
  );
  const todayPromise = db.from("articles").select("id", head).gte("first_published_at", today.fromIso).lt("first_published_at", today.toIso);
  const publishedPromise = db
    .from("articles")
    .select("first_published_at")
    .gte("first_published_at", range.fromIso)
    .lt("first_published_at", range.toIso)
    .limit(SCAN_LIMIT);
  const writersPromise = db.from("articles").select("author_id").gte("updated_at", range.fromIso).lt("updated_at", range.toIso).limit(SCAN_LIMIT);
  const activityPromise = db
    .from("content_activity_logs")
    .select("id, created_at, entity_type, entity_id, action, from_status, to_status, note, actor:profiles(display_name)")
    .gte("created_at", range.fromIso)
    .lt("created_at", range.toIso)
    .order("created_at", { ascending: false })
    .limit(12);

  const analyticsPromise: Promise<AnalyticsSummary | null | "error"> = has("analytics.view")
    ? loadAnalyticsSummary(ctx, range).catch(() => "error" as const)
    : Promise.resolve(null);

  const pollsPromise = has("polls.view_results") || has("polls.manage") ? loadPolls(ctx, has("analytics.view")) : Promise.resolve(null);
  const newsletterPromise = has("newsletter.view")
    ? Promise.all([
        db.from("newsletter_subscribers").select("id", head).eq("status", "subscribed"),
        db.from("newsletter_subscribers").select("id", head).eq("status", "subscribed").gte("subscribed_at", range.fromIso).lt("subscribed_at", range.toIso),
      ]).then(([a, b]) => ({ subscribed: count(a), newInRange: count(b) }))
    : Promise.resolve(null);

  let recentQuery = db
    .from("articles")
    .select("id, title, status, updated_at, category:categories!articles_category_id_fkey(name)")
    .order("updated_at", { ascending: false })
    .limit(6);
  // Without view_all, RLS still shows other people's published stories; "recent work" means the viewer's own.
  if (!has("articles.view_all")) recentQuery = recentQuery.eq("author_id", ctx.userId);

  const teamPromise = has("users.view")
    ? db
        .from("user_roles")
        .select("user_id, profile:profiles!user_roles_user_id_fkey(is_active)")
        .then((res) => {
          if (res.error) throw res.error;
          const staff = (res.data as unknown as { profile: { is_active: boolean } | null }[]).filter((r) => r.profile);
          return { total: staff.length, active: staff.filter((r) => r.profile!.is_active).length };
        })
    : Promise.resolve(null);
  const reportsPromise = has("moderation.manage")
    ? db.from("moderation_reports").select("id", head).eq("status", "open").then(count)
    : Promise.resolve(null);
  const adsPromise = has("ads.manage")
    ? db
        .from("ad_slots")
        .select("is_active, starts_at, ends_at")
        .eq("is_active", true)
        .then((res) => {
          if (res.error) throw res.error;
          return (res.data ?? []).filter((slot) => adStatus(slot) === "live").length;
        })
    : Promise.resolve(null);

  const [statuses, todayRes, publishedRes, writersRes, activityRes, analytics, polls, newsletter, recentRes, team, openReports, activeAds] = await Promise.all([
    statusPromise,
    todayPromise,
    publishedPromise,
    writersPromise,
    activityPromise,
    analyticsPromise,
    pollsPromise,
    newsletterPromise,
    recentQuery,
    teamPromise,
    reportsPromise,
    adsPromise,
  ]);
  if (publishedRes.error) throw publishedRes.error;
  if (writersRes.error) throw writersRes.error;
  if (activityRes.error) throw activityRes.error;
  if (recentRes.error) throw recentRes.error;

  const statusCounts = Object.fromEntries(statuses) as Record<ArticleStatus, number>;
  const byDay = new Map<string, number>();
  for (const r of publishedRes.data ?? []) {
    if (!r.first_published_at) continue;
    const d = manilaDay(r.first_published_at);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  type RecentRow = { id: string; title: string; status: ArticleStatus; updated_at: string; category: { name: string } | null };
  return {
    allArticles: has("articles.view_all"),
    recent: (recentRes.data as unknown as RecentRow[]).map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updated_at, category: r.category?.name ?? null })),
    team,
    openReports,
    activeAds,
    statusCounts,
    totalArticles: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    publishedToday: count(todayRes),
    publicationByDay: fillDays(range.days, [...byDay].map(([day, articles]) => ({ day, articles })), ["articles"]),
    publishedInRange: (publishedRes.data ?? []).length,
    activeWriters: new Set((writersRes.data ?? []).map((r) => r.author_id)).size,
    scanTruncated: (publishedRes.data ?? []).length >= SCAN_LIMIT || (writersRes.data ?? []).length >= SCAN_LIMIT,
    activity: await withTitles(ctx, activityRes.data ?? []),
    analytics: analytics === "error" ? null : analytics,
    analyticsError: analytics === "error",
    polls,
    newsletter,
  };
}

async function loadPolls(ctx: StaffContext, hasAnalytics: boolean) {
  const now = Date.now();
  // Same rule as poll_is_open(): published and inside its optional open/close window.
  const { data: published, error: pollsError } = await ctx.supabase.from("polls").select("opens_at, closes_at").eq("status", "published");
  if (pollsError) throw pollsError;
  const active = (published ?? []).filter(
    (p) => (!p.opens_at || Date.parse(p.opens_at) <= now) && (!p.closes_at || Date.parse(p.closes_at) > now),
  ).length;
  let ballotsAllTime: number | null = null;
  if (!hasAnalytics) {
    const { data, error } = await ctx.supabase.rpc("get_total_ballots");
    if (error) throw error;
    ballotsAllTime = Number(data ?? 0);
  }
  return { active, ballotsAllTime };
}

type ActivityRow = {
  id: number;
  created_at: string;
  entity_type: string;
  entity_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor: { display_name: string } | null;
};

async function withTitles(ctx: StaffContext, rows: ActivityRow[]): Promise<ActivityItem[]> {
  const articleIds = [...new Set(rows.filter((r) => r.entity_type === "article").map((r) => r.entity_id))];
  const titles = new Map<string, string>();
  if (articleIds.length > 0) {
    // RLS decides which titles this viewer may see; others stay untitled.
    const { data, error } = await ctx.supabase.from("articles").select("id, title").in("id", articleIds);
    if (error) throw error;
    for (const a of data ?? []) titles.set(a.id, a.title);
  }
  return rows.map((r) => ({
    id: r.id,
    at: r.created_at,
    actor: r.actor?.display_name ?? null,
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: titles.get(r.entity_id) ?? null,
    action: r.action,
    from: r.from_status,
    to: r.to_status,
    note: r.note,
  }));
}
