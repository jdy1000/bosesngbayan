import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { loadDashboard, DASHBOARD_STATUSES } from "@/lib/studio/dashboard";
import { manilaToday, parseRange } from "@/lib/studio/range";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ARTICLE_STATUS, AccessChip, Empty, Notice, PageHeader, Panel, SectionHeading, Stat, StatStrip, StatusBadge, withParams } from "@/components/studio/ui";
import { RangeFilter, RankList } from "./_overview/range-filter";
import { TrendChart } from "./_overview/trend-chart";
import { MetricDefinitions } from "./_overview/metric-definitions";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A row of a list that sits flush in a Panel: 22px sides, soft hover when it is a link. */
const ROW = "flex items-center justify-between gap-5 px-[22px] py-4";

/**
 * Overview. The top follows the Newsmaker console (ADR-021): one strip of linked figures, then what changed
 * last beside the workflow counts. The range filter, trends and activity log below it are the Boses additions
 * the spec asks for (§4.1).
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  // No permission argument: requireStaffPage redirects denials to /admin, which would loop here.
  const ctx = await requireStaffPage();
  const sp = await searchParams;
  if (!ctx.permissions.has("dashboard.view")) {
    return (
      <>
        <PageHeader eyebrow="Publishing center" title={`Welcome, ${ctx.displayName}`} />
        <Notice tone={sp.denied === "1" ? "warn" : "info"}>
          {sp.denied === "1" && "Your account does not have access to that area. "}
          Your role does not include dashboard access. Use the menu to open the modules you are allowed to use.
        </Notice>
      </>
    );
  }
  const range = parseRange(sp, "7d");
  const data = await loadDashboard(ctx, range);
  const a = data.analytics;
  const rangeQuery = { range: range.preset, from: range.preset === "custom" ? range.fromDate : undefined, to: range.preset === "custom" ? range.toDate : undefined };

  return (
    <>
      <PageHeader
        eyebrow="Publishing center"
        title={`Welcome, ${ctx.displayName}`}
        description="Live editorial, audience, and publishing operations."
        actions={<AccessChip>Access: {ROLE_LABELS[ctx.role]}</AccessChip>}
      />
      {sp.denied === "1" && (
        <div className="mb-6">
          <Notice tone="warn">Your account does not have access to that area.</Notice>
        </div>
      )}

      <section aria-labelledby="operations-heading" className="mb-6">
        <SectionHeading kicker={data.allArticles ? "Entire publication" : "Articles you can access"} title="Overall operations" id="operations-heading" />
        <StatStrip>
          <Stat label="Articles" value={formatNumber(data.totalArticles)} hint={`${formatNumber(data.statusCounts.published)} published`} href="/admin/articles" />
          {a && <Stat label={`Reads · ${range.label}`} value={formatNumber(a.page_views)} hint="Aggregated page views" href={withParams("/admin/analytics", rangeQuery)} />}
          {data.team && <Stat label="Newsroom users" value={formatNumber(data.team.total)} hint={`${formatNumber(data.team.active)} active`} href="/admin/team" />}
          {data.openReports !== null && <Stat label="Open reports" value={formatNumber(data.openReports)} hint="Open or under review" href="/admin/moderation?tab=reports" />}
          {data.activeAds !== null && <Stat label="Active ads" value={formatNumber(data.activeAds)} hint="Live placements" href="/admin/ads" />}
          {data.newsletter && <Stat label="Subscribers" value={formatNumber(data.newsletter.subscribed)} hint="Consented readers" href="/admin/newsletter" />}
        </StatStrip>
      </section>

      <div className="mb-6 grid items-start gap-6 min-[1101px]:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]">
        <Panel
          flush
          title="Recently updated"
          labelledBy="recent-heading"
          description={data.allArticles ? "Latest work across the publication." : "Latest work on your own articles."}
          actions={
            <Link href="/admin/articles" className="text-[13px] font-bold text-brand hover:underline">
              View all <span aria-hidden="true">→</span>
            </Link>
          }
        >
          {data.recent.length === 0 ? (
            <Empty bare title="No articles yet">
              Create the publication’s first story.
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent.map((article) => (
                <li key={article.id}>
                  <Link href={`/admin/articles/${article.id}`} className={`${ROW} transition-colors hover:bg-surface`}>
                    <span className="min-w-0">
                      <strong className="block truncate text-[15px] font-semibold text-ink">{article.title}</strong>
                      <small className="mt-[5px] block text-xs text-muted">
                        {article.category ?? "No category"} · {formatDateTime(article.updatedAt)}
                      </small>
                    </span>
                    <StatusBadge status={article.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel flush title="Editorial workflow" labelledBy="workflow-heading" description="Current article state.">
          <ul className="divide-y divide-line">
            {DASHBOARD_STATUSES.map((status) => (
              <li key={status}>
                <Link href={`/admin/articles?status=${status}`} className={`${ROW} text-[15px] text-ink-soft transition-colors hover:bg-surface`}>
                  <span>{ARTICLE_STATUS[status]?.label ?? status}</span>
                  <strong className="text-lg font-bold tabular-nums text-ink">{formatNumber(data.statusCounts[status])}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section aria-labelledby="trends-heading" className="mb-6">
        <SectionHeading kicker="Over time" title="Publishing and audience trends" id="trends-heading" />
        <RangeFilter action="/admin" range={range} today={manilaToday()} />
        <StatStrip>
          <Stat label="Published in range" value={formatNumber(data.publishedInRange)} hint={range.label} />
          <Stat label="Published today" value={formatNumber(data.publishedToday)} hint="First publication, Manila day" />
          <Stat label="Active writers" value={formatNumber(data.activeWriters)} hint="Authors of articles modified in range" />
          {data.polls && (
            <Stat
              label={data.polls.ballotsAllTime === null ? "Ballots in range" : "Ballots (all time)"}
              value={formatNumber(data.polls.ballotsAllTime ?? a?.poll_ballots ?? 0)}
              hint={`${formatNumber(data.polls.active)} active polls now`}
            />
          )}
          {data.newsletter && <Stat label="New subscribers" value={formatNumber(data.newsletter.newInRange)} hint="Subscribed in range" />}
        </StatStrip>
      </section>
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
              <Empty bare title="No page views recorded in this range yet." />
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
            <Empty bare title="No articles published in this range." />
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

      <Panel flush title="Recent editorial activity" description="Status and moderation changes in range." className="mb-6">
        {data.activity.length === 0 ? (
          <Empty bare title="No editorial activity in this range." />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {data.activity.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-[22px] py-3.5 sm:flex-row sm:items-center sm:gap-3">
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
