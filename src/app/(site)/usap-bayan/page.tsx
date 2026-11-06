import Link from "next/link";
import { EmptyState } from "@/components/public/article-card";
import { parsePage } from "@/components/public/article-list-page";
import { SubmissionForm } from "@/components/public/submission-form";
import { COMMUNITY_KIND_LABELS, COMMUNITY_KINDS, listApprovedPosts } from "@/lib/cms/community";
import { getSiteSettings, listCategories } from "@/lib/cms/site";
import { timeAgo, truncate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { localizeSettings } from "@/lib/settings/schema";

type Props = { searchParams: Promise<{ page?: string; uri?: string }> };

export async function generateMetadata() {
  const { t } = await getI18n();
  return buildMetadata({ title: "Usap Bayan", description: t.community.metaDescription, path: "/usap-bayan" });
}

export default async function CommunityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const kind = COMMUNITY_KINDS.find((k) => k === sp.uri);
  const page = parsePage(sp.page);
  const [rawSettings, categories, featured, list, { locale, t }] = await Promise.all([
    getSiteSettings(),
    listCategories(),
    page === 1 && !kind ? listApprovedPosts({ featuredOnly: true, pageSize: 2, withTotal: false }) : Promise.resolve(null),
    listApprovedPosts({ kind, page, pageSize: 12 }),
    getI18n(),
  ]);
  const settings = localizeSettings(rawSettings, locale);
  const c = t.community;
  const kindLabels = COMMUNITY_KIND_LABELS[locale];
  const featuredIds = new Set(featured?.items.map((p) => p.id));
  const items = list.items.filter((p) => !featuredIds.has(p.id));

  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-8 max-w-3xl">
        <h1 className="text-4xl font-semibold text-ink md:text-5xl">Usap Bayan</h1>
        <p className="mt-3 text-lg text-ink-soft">{c.intro}</p>
      </header>

      {featured && featured.items.length > 0 && (
        <section aria-label={c.featuredSection} className="mb-12 grid gap-6 md:grid-cols-2">
          {featured.items.map((p) => (
            <article key={p.id} className="relative rounded-md bg-navy p-7 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">{c.featured} · {kindLabels[p.kind]}</p>
              <h2 className="mt-2 text-2xl font-semibold leading-snug">
                <Link href={`/usap-bayan/${p.id}`} className="after:absolute after:inset-0">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-3 line-clamp-3 text-white/80">{truncate(p.body, 260)}</p>
              <p className="mt-4 text-sm text-white/60">{p.author_name}</p>
            </article>
          ))}
        </section>
      )}

      <nav aria-label={c.kindNav} className="mb-6 flex flex-wrap gap-2">
        <Link href="/usap-bayan" className="chip" data-active={!kind || undefined} aria-current={!kind ? "page" : undefined}>
          {c.all}
        </Link>
        {COMMUNITY_KINDS.map((k) => (
          <Link key={k} href={`/usap-bayan?uri=${k}`} className="chip" aria-current={kind === k ? "page" : undefined}>
            {kindLabels[k]}
          </Link>
        ))}
      </nav>

      <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label={c.discussions}>
          {items.length === 0 ? (
            <EmptyState title={c.emptyTitle}>{c.emptyBody}</EmptyState>
          ) : (
            <ul className="space-y-4">
              {items.map((p) => (
                <li key={p.id}>
                  <article className="card relative p-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-accent">
                      {kindLabels[p.kind]}
                      {p.category ? ` · ${p.category.name}` : ""}
                    </p>
                    <h2 className="mt-1.5 text-xl font-semibold text-ink">
                      <Link href={`/usap-bayan/${p.id}`} className="after:absolute after:inset-0 hover:text-brand">
                        {p.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-2 text-[0.95rem] text-ink-soft">{truncate(p.body, 200)}</p>
                    <p className="mt-3 text-sm text-muted">
                      {p.author_name}
                      {p.author_location ? ` · ${p.author_location}` : ""} · {timeAgo(p.published_at, undefined, locale)}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {list.totalPages > 1 && (
            <nav aria-label={c.pagination} className="mt-8 flex items-center justify-between text-sm">
              {page > 1 ? <Link className="btn btn-outline" href={`/usap-bayan?${new URLSearchParams({ ...(kind ? { uri: kind } : {}), page: String(page - 1) })}`}>{c.prev}</Link> : <span />}
              <span className="text-muted">{fmt(c.pageOf, { page, total: list.totalPages })}</span>
              {page < list.totalPages ? <Link className="btn btn-outline" href={`/usap-bayan?${new URLSearchParams({ ...(kind ? { uri: kind } : {}), page: String(page + 1) })}`}>{c.next}</Link> : <span />}
            </nav>
          )}
        </section>

        <aside id="magbahagi" aria-labelledby="submit-heading" className="h-fit rounded-md border border-line p-6 lg:sticky lg:top-32">
          <h2 id="submit-heading" className="text-2xl font-semibold text-ink">{c.shareVoice}</h2>
          {settings.community.submissions_enabled ? (
            <div className="mt-4">
              <SubmissionForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} guidelines={settings.community.guidelines} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">{c.submissionsClosed}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
