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
        title="Analytics"
        description="First-party na sukatan ng pagbasa, botohan at newsletter. Aggregated tuwing bubuksan ang pahina; hindi real-time."
      />
      <RangeFilter action="/admin/analytics" range={range} today={manilaToday()} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Page views" value={formatNumber(s.page_views)} />
        <Stat label="Bisita (tinatayang)" value={formatNumber(s.daily_unique_visitors_sum)} hint="Suma ng araw-araw" />
        <Stat label="Views bawat bisita" value={viewsPerVisitor} />
        <Stat label="Mga balota" value={formatNumber(s.poll_ballots)} />
        <Stat label="Bagong subscriber" value={formatNumber(s.new_subscribers)} hint="Naka-subscribe pa rin" />
        <Stat label="Nailathalang artikulo" value={formatNumber(s.articles_published)} />
      </div>

      <Panel title="Traffic trend" description="Page views at tinatayang bisita kada araw (Maynila)." className="mb-6">
        {s.page_views === 0 ? (
          <Empty title="Wala pang naitalang page view sa saklaw na ito.">Lalabas dito ang datos kapag may bumisita sa pampublikong site.</Empty>
        ) : (
          <TrendChart
            ariaLabel="Page views at bisita kada araw"
            data={traffic}
            height={300}
            series={[
              { key: "views", label: "Page views", color: "#1d4ed8" },
              { key: "visitors", label: "Bisita (tinatayang)", color: "#0b1f5c" },
            ]}
          />
        )}
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Top articles" description="Pinakamaraming page view sa saklaw.">
          <RankList
            empty="Wala pang article view sa saklaw na ito."
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
        <Panel title="Category engagement" description="Page view ng mga artikulo ayon sa kategorya.">
          <RankList empty="Wala pang datos ng kategorya." rows={s.top_categories.map((c) => ({ key: c.category_id, value: c.views, label: c.name }))} />
        </Panel>
        <Panel title="Referring sources" description="Host ng pinanggalingang site; “(direkta)” kapag walang referrer.">
          <RankList empty="Wala pang referrer data." rows={s.top_referrers.map((r) => ({ key: r.host, value: r.views, label: r.host }))} />
        </Panel>
        <Panel title="Poll participation" description="Mga balota kada botohan sa saklaw.">
          <RankList
            empty="Walang bumoto sa saklaw na ito."
            rows={s.top_polls.map((p) => ({
              key: p.poll_id,
              value: p.ballots,
              label: (
                <Link href={`/admin/polls/${p.poll_id}`} className="hover:text-brand">
                  {p.question}
                </Link>
              ),
            }))}
          />
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Mga balota kada araw">
          {s.poll_ballots === 0 ? (
            <Empty title="Walang balota sa saklaw na ito." />
          ) : (
            <TrendChart kind="bar" ariaLabel="Mga balota kada araw" data={ballots} series={[{ key: "ballots", label: "Balota", color: "#1d4ed8" }]} />
          )}
        </Panel>
        <Panel title="Newsletter growth" description="Bagong subscriber kada araw (hindi kasama ang nag-unsubscribe na).">
          {s.new_subscribers === 0 ? (
            <Empty title="Walang bagong subscriber sa saklaw na ito." />
          ) : (
            <TrendChart kind="bar" ariaLabel="Bagong subscriber kada araw" data={subscribers} series={[{ key: "subscribers", label: "Subscriber", color: "#0b1f5c" }]} />
          )}
        </Panel>
      </div>

      <MetricDefinitions showAnalytics />
      <p className="mt-3 text-xs text-muted">
        Retention: ang database function na purge_old_analytics() ay nagbubura ng page-view event na mas matanda sa 13 buwan; pinapatakbo ito araw-araw ng /api/cron/retention (vercel.json) kapag naka-set ang CRON_SECRET. Hanggang 400 araw ang pinakamahabang saklaw.
</p>
    </>
  );
}
