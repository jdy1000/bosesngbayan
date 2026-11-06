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
        <PageHeader title={`Magandang araw, ${ctx.displayName}`} />
        <Notice tone={sp.denied === "1" ? "warn" : "info"}>
          {sp.denied === "1" && "Wala kang pahintulot na buksan ang pahinang iyon. "}
          Walang dashboard access ang iyong role. Gamitin ang menu para sa mga module na pinapayagan sa iyo.
        </Notice>
      </>
    );
  }
  const range = parseRange(sp, "7d");
  const data = await loadDashboard(ctx, range);
  const a = data.analytics;
  const scope = data.allArticles ? "Lahat ng artikulo" : "Mga artikulong saklaw ng iyong access";

  return (
    <>
      <PageHeader
        title={`Magandang araw, ${ctx.displayName}`}
        description="Buod ng newsroom mula sa mga aktwal na tala sa database. Walang tinantiyang numero."
        actions={
          ctx.permissions.has("articles.create") && (
            <Link href="/admin/articles/new" className="btn btn-primary min-h-10 px-4 text-sm">
              Bagong artikulo
            </Link>
          )
        }
      />
      {sp.denied === "1" && (
        <div className="mb-4">
          <Notice tone="warn">Wala kang pahintulot na buksan ang pahinang iyon. Ibinalik ka sa Dashboard.</Notice>
        </div>
      )}
      <RangeFilter action="/admin" range={range} today={manilaToday()} />

      <section aria-labelledby="articles-heading" className="mb-6">
        <h2 id="articles-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Mga artikulo · {scope} (kasalukuyang status)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Kabuuan" value={formatNumber(data.totalArticles)} />
          <Stat label="Nakalathala" value={formatNumber(data.statusCounts.published)} />
          <Stat label="Para sa review" value={formatNumber(data.statusCounts.pending_review)} />
          <Stat label="Naka-iskedyul" value={formatNumber(data.statusCounts.scheduled)} />
          <Stat label="Nailathala ngayon" value={formatNumber(data.publishedToday)} hint="Unang paglalathala, araw sa Maynila" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {DASHBOARD_STATUSES.map((s) => (
            <Link key={s} href={`/admin/articles?status=${s}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 hover:border-brand">
              <StatusBadge status={s} />
              <span className="font-semibold tabular-nums">{formatNumber(data.statusCounts[s])}</span>
              <span className="sr-only">{ARTICLE_STATUS[s]?.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nailathala sa saklaw" value={formatNumber(data.publishedInRange)} hint={range.label} />
        <Stat label="Aktibong manunulat" value={formatNumber(data.activeWriters)} hint="May-akda ng artikulong binago sa saklaw" />
        {a && <Stat label="Page views" value={formatNumber(a.page_views)} hint="Aggregated, hindi real-time" />}
        {data.polls && (
          <Stat
            label={data.polls.ballotsAllTime === null ? "Mga balota sa saklaw" : "Mga balota (lahat ng panahon)"}
            value={formatNumber(data.polls.ballotsAllTime ?? a?.poll_ballots ?? 0)}
            hint={`${formatNumber(data.polls.active)} aktibong botohan ngayon`}
          />
        )}
        {data.newsletter && (
          <Stat label="Newsletter subscribers" value={formatNumber(data.newsletter.subscribed)} hint={`+${formatNumber(data.newsletter.newInRange)} sa saklaw`} />
        )}
      </div>
      {data.scanTruncated && (
        <div className="mb-6">
          <Notice tone="warn">Masyadong malaki ang saklaw; ang publication activity at aktibong manunulat ay batay sa unang 5,000 tala lamang.</Notice>
        </div>
      )}
      {data.analyticsError && (
        <div className="mb-6">
          <Notice tone="error">Hindi makuha ang analytics para sa saklaw na ito. Subukang muli.</Notice>
        </div>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        {a && (
          <Panel title="Traffic trend" description="Page views at tinatayang bisita kada araw (Maynila).">
            {a.page_views === 0 ? (
              <Empty title="Wala pang naitalang page view sa saklaw na ito." />
            ) : (
              <TrendChart
                ariaLabel="Page views kada araw"
                data={fillTraffic(range.days, a.views_by_day)}
                series={[
                  { key: "views", label: "Page views", color: "#1d4ed8" },
                  { key: "visitors", label: "Bisita (tinatayang)", color: "#0b1f5c" },
                ]}
              />
            )}
          </Panel>
        )}
        <Panel title="Publication activity" description="Mga artikulong unang nailathala kada araw.">
          {data.publishedInRange === 0 ? (
            <Empty title="Walang nailathalang artikulo sa saklaw na ito." />
          ) : (
            <TrendChart kind="bar" ariaLabel="Mga nailathalang artikulo kada araw" data={data.publicationByDay} series={[{ key: "articles", label: "Artikulo", color: "#1d4ed8" }]} />
          )}
        </Panel>
      </div>

      {a && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Top stories" description="Pinakamaraming page view sa saklaw.">
            <RankList
              empty="Wala pang article view sa saklaw na ito."
              rows={a.top_articles.map((t) => ({ key: t.article_id, value: t.views, label: <Link href={`/admin/articles/${t.article_id}`} className="hover:text-brand">{t.title}</Link> }))}
            />
          </Panel>
          <Panel title="Most-read categories" description="Page view ng mga artikulo ayon sa kategorya.">
            <RankList empty="Wala pang datos ng kategorya sa saklaw na ito." rows={a.top_categories.map((c) => ({ key: c.category_id, value: c.views, label: c.name }))} />
          </Panel>
        </div>
      )}

      <Panel
        title="Recent editorial activity"
        description="Mga pagbabago ng status at moderation sa saklaw."
        actions={ctx.permissions.has("audit.view") && <Link href="/admin/audit" className="text-sm font-semibold text-brand hover:underline">Audit log →</Link>}
        className="mb-6"
      >
        {data.activity.length === 0 ? (
          <Empty title="Walang editorial activity sa saklaw na ito." />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {data.activity.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-44 shrink-0 text-xs text-muted">{formatDateTime(e.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{e.actor ?? (e.action === "scheduler" ? "Scheduler" : "Hindi kilala")}</span>{" "}
                  <span className="text-ink-soft">{e.action === "transition" || e.action === "scheduler" ? "binago ang status ng" : e.action}</span>{" "}
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
