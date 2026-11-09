import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { loadAnalyticsSummary } from "@/lib/studio/analytics";
import { fillDays, manilaToday, parseRange } from "@/lib/studio/range";
import { formatNumber } from "@/lib/format";
import { Empty, PageHeader, Panel } from "@/components/studio/ui";
import { RangeFilter, RankList, Stat } from "../_overview/range-filter";
import { TrendChart } from "../_overview/trend-chart";
import { MetricDefinitions } from "../_overview/metric-definitions";

export const metadata: Metadata = { title: "Analytics" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireStaffPage("analytics.view");
  const range = parseRange(await searchParams, "30d");
  const s = await loadAnalyticsSummary(ctx, range);

  const traffic = fillDays(range.days, s.views_by_day, ["views", "visitors"]);
  const ballots = fillDays(range.days, s.ballots_by_day, ["ballots"]);
  const subscribers = fillDays(range.days, s.subscribers_by_day, ["subscribers"]);
  const viewsPerVisitor = s.daily_unique_visitors_sum > 0 ? (s.page_views / s.daily_unique_visitors_sum).toFixed(2) : "—";

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="First-party metrics for reading, polls and newsletter. Aggregated each time this page opens; not real-time."
      />
      <RangeFilter action="/admin/analytics" range={range} today={manilaToday()} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Page views" value={formatNumber(s.page_views)} />
        <Stat label="Visitors (estimated)" value={formatNumber(s.daily_unique_visitors_sum)} hint="Sum of daily counts" />
        <Stat label="Views per visitor" value={viewsPerVisitor} />
        <Stat label="Ballots" value={formatNumber(s.poll_ballots)} />
        <Stat label="New subscribers" value={formatNumber(s.new_subscribers)} hint="Still subscribed" />
        <Stat label="Articles published" value={formatNumber(s.articles_published)} />
      </div>

      <Panel title="Traffic trend" description="Page views and estimated visitors per day (Manila)." className="mb-6">
        {s.page_views === 0 ? (
          <Empty title="No page views recorded in this range yet.">Data appears here once people visit the public site.</Empty>
        ) : (
          <TrendChart
            ariaLabel="Page views and visitors per day"
            data={traffic}
            height={300}
            series={[
              { key: "views", label: "Page views", color: "var(--color-brand)" },
              { key: "visitors", label: "Visitors (estimated)", color: "var(--color-chart-2)" },
            ]}
          />
        )}
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Top articles" description="Most page views in range.">
          <RankList
            empty="No article views in this range yet."
            rows={s.top_articles.map((t) => ({
              key: t.article_id,
              value: t.views,
              label: (
                <Link href={`/admin/articles/${t.article_id}`} className="hover:text-brand">
                  {t.title}
                </Link>
              ),
            }))}
          />
        </Panel>
        <Panel title="Category engagement" description="Article page views by category.">
          <RankList empty="No category data yet." rows={s.top_categories.map((c) => ({ key: c.category_id, value: c.views, label: c.name }))} />
        </Panel>
        <Panel title="Referring sources" description="Host of the referring site; “(direkta)” when there is no referrer.">
          <RankList empty="No referrer data yet." rows={s.top_referrers.map((r) => ({ key: r.host, value: r.views, label: r.host }))} />
        </Panel>
        <Panel title="Poll participation" description="Ballots per poll in range.">
          <RankList
            empty="No votes in this range."
            rows={s.top_polls.map((p) => ({
              key: p.poll_id,
              value: p.ballots,
              label: p.question,
            }))}
          />
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Ballots per day">
          {s.poll_ballots === 0 ? (
            <Empty title="No ballots in this range." />
          ) : (
            <TrendChart kind="bar" ariaLabel="Ballots per day" data={ballots} series={[{ key: "ballots", label: "Ballots", color: "var(--color-brand)" }]} />
          )}
        </Panel>
        <Panel title="Newsletter growth" description="New subscribers per day (excluding those who have since unsubscribed).">
          {s.new_subscribers === 0 ? (
            <Empty title="No new subscribers in this range." />
          ) : (
            <TrendChart kind="bar" ariaLabel="New subscribers per day" data={subscribers} series={[{ key: "subscribers", label: "Subscribers", color: "var(--color-chart-2)" }]} />
          )}
        </Panel>
      </div>

      <MetricDefinitions showAnalytics />
      <p className="mt-3 text-xs text-muted">
        Retention: the database function purge_old_analytics() deletes page-view events older than 13 months; /api/cron/retention (vercel.json) runs it daily when CRON_SECRET is set. The longest range is 400 days.
</p>
    </>
  );
}
