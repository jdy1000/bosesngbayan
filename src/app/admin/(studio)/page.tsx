import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { loadDashboard, DASHBOARD_STATUSES } from "@/lib/studio/dashboard";
import { manilaToday, parseRange } from "@/lib/studio/range";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ARTICLE_STATUS, Empty, Notice, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { RangeFilter, RankList, Stat } from "./_overview/range-filter";
import { TrendChart } from "./_overview/trend-chart";
import { MetricDefinitions } from "./_overview/metric-definitions";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  // No permission argument: requireStaffPage redirects denials to /admin, which would loop here.
  const ctx = await requireStaffPage();
  const sp = await searchParams;
  if (!ctx.permissions.has("dashboard.view")) {
    return (
      <>
        <PageHeader eyebrow="Publishing center" title={`Welcome, ${ctx.displayName}`} />
        <Notice tone={sp.denied === "1" ? "warn" : "info"}>
          {sp.denied === "1" && "You do not have permission to open that page. "}
          Your role does not include dashboard access. Use the menu to open the modules you are allowed to use.
        </Notice>
      </>
    );
  }
  const range = parseRange(sp, "7d");
  const data = await loadDashboard(ctx, range);
  const a = data.analytics;
  const scope = data.allArticles ? "All articles" : "Articles you can access";

  return (
    <>
      <PageHeader
        eyebrow="Publishing center"
        title={`Welcome, ${ctx.displayName}`}
        description="Editorial, audience, and publishing operations, from stored records."
        actions={<span className="rounded-full bg-paper px-3 py-1.5 text-sm font-semibold text-ink-soft ring-1 ring-line">Access: {ROLE_LABELS[ctx.role]}</span>}
      />
      {sp.denied === "1" && (
        <div className="mb-4">
          <Notice tone="warn">You do not have permission to open that page. You were sent back to the Dashboard.</Notice>
        </div>
      )}
      <RangeFilter action="/admin" range={range} today={manilaToday()} />

      <section aria-labelledby="articles-heading" className="mb-6">
        <h2 id="articles-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Articles · {scope} (current status)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total" value={formatNumber(data.totalArticles)} />
          <Stat label="Published" value={formatNumber(data.statusCounts.published)} />
          <Stat label="In review" value={formatNumber(data.statusCounts.pending_review)} />
          <Stat label="Scheduled" value={formatNumber(data.statusCounts.scheduled)} />
          <Stat label="Published today" value={formatNumber(data.publishedToday)} hint="First publication, Manila day" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {DASHBOARD_STATUSES.map((s) => (
            <Link key={s} href={`/admin/articles?status=${s}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 hover:border-brand">
              <StatusBadge status={s} />
              <span className="font-semibold tabular-nums">{formatNumber(data.statusCounts[s])}</span>
              <span className="sr-only">{ARTICLE_STATUS[s]?.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Published in range" value={formatNumber(data.publishedInRange)} hint={range.label} />
        <Stat label="Active writers" value={formatNumber(data.activeWriters)} hint="Authors of articles modified in range" />
        {a && <Stat label="Page views" value={formatNumber(a.page_views)} hint="Aggregated, not real-time" />}
        {data.polls && (
          <Stat
            label={data.polls.ballotsAllTime === null ? "Ballots in range" : "Ballots (all time)"}
            value={formatNumber(data.polls.ballotsAllTime ?? a?.poll_ballots ?? 0)}
            hint={`${formatNumber(data.polls.active)} active polls now`}
          />
        )}
        {data.newsletter && (
          <Stat label="Newsletter subscribers" value={formatNumber(data.newsletter.subscribed)} hint={`+${formatNumber(data.newsletter.newInRange)} in range`} />
        )}
      </div>
      {data.scanTruncated && (
        <div className="mb-6">
          <Notice tone="warn">The range is too large; publication activity and active writers are based on the first 5,000 records only.</Notice>
        </div>
      )}
      {data.analyticsError && (
        <div className="mb-6">
          <Notice tone="error">Could not load analytics for this range. Try again.</Notice>
        </div>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        {a && (
          <Panel title="Traffic trend" description="Page views and estimated visitors per day (Manila).">
            {a.page_views === 0 ? (
              <Empty title="No page views recorded in this range yet." />
            ) : (
              <TrendChart
                ariaLabel="Page views per day"
                data={fillTraffic(range.days, a.views_by_day)}
                series={[
                  { key: "views", label: "Page views", color: "var(--color-brand)" },
                  { key: "visitors", label: "Visitors (estimated)", color: "var(--color-chart-2)" },
                ]}
              />
            )}
          </Panel>
        )}
        <Panel title="Publication activity" description="Articles first published per day.">
          {data.publishedInRange === 0 ? (
            <Empty title="No articles published in this range." />
          ) : (
            <TrendChart kind="bar" ariaLabel="Articles published per day" data={data.publicationByDay} series={[{ key: "articles", label: "Articles", color: "var(--color-brand)" }]} />
          )}
        </Panel>
      </div>

      {a && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Top stories" description="Most page views in range.">
            <RankList
              empty="No article views in this range yet."
              rows={a.top_articles.map((t) => ({ key: t.article_id, value: t.views, label: <Link href={`/admin/articles/${t.article_id}`} className="hover:text-brand">{t.title}</Link> }))}
            />
          </Panel>
          <Panel title="Most-read categories" description="Article page views by category.">
            <RankList empty="No category data in this range yet." rows={a.top_categories.map((c) => ({ key: c.category_id, value: c.views, label: c.name }))} />
          </Panel>
        </div>
      )}

      <Panel
        title="Recent editorial activity"
        description="Status and moderation changes in range."
        className="mb-6"
      >
        {data.activity.length === 0 ? (
          <Empty title="No editorial activity in this range." />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {data.activity.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-44 shrink-0 text-xs text-muted">{formatDateTime(e.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{e.actor ?? (e.action === "scheduler" ? "Scheduler" : "Unknown")}</span>{" "}
                  <span className="text-ink-soft">{e.action === "transition" || e.action === "scheduler" ? "changed the status of" : e.action}</span>{" "}
                  {e.entityType === "article" && e.title ? (
                    <Link href={`/admin/articles/${e.entityId}`} className="font-medium text-ink hover:text-brand">
                      {e.title}
                    </Link>
                  ) : (
                    <span className="text-muted">{e.entityType}</span>
                  )}
                  {e.note && <span className="block truncate text-xs text-muted">“{e.note}”</span>}
                </span>
                {(e.from || e.to) && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {e.from && <StatusBadge status={e.from} />}
                    <span aria-hidden="true" className="text-muted">→</span>
                    {e.to && <StatusBadge status={e.to} />}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <MetricDefinitions showAnalytics={Boolean(a)} />
    </>
  );
}

function fillTraffic(days: string[], rows: { day: string; views: number; visitors: number }[]) {
  const m = new Map(rows.map((r) => [r.day.slice(0, 10), r]));
  return days.map((day) => ({ day, views: m.get(day)?.views ?? 0, visitors: m.get(day)?.visitors ?? 0 }));
}
