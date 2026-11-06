import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { ArticleCard, EmptyState, SectionHeading } from "@/components/public/article-card";
import type { BlockSettings } from "@/lib/homepage/blocks";
import {
  getMostReadArticles,
  getPublicArticlesByIds,
  listPublicArticles,
  type ArticleCard as Article,
} from "@/lib/cms/articles";
import { listApprovedPosts, COMMUNITY_KIND_LABELS } from "@/lib/cms/community";
import { listCategories, listLocations, listTrendingTopics, type CategorySummary } from "@/lib/cms/site";
import { formatDateline } from "@/lib/format";

type ListSettings = BlockSettings<"article_grid">;
export type ListLayout = "grid" | "list" | "side";

/** Resolves an article-list block's configured source to published articles only. */
async function resolveArticles(s: ListSettings): Promise<Article[]> {
  switch (s.source) {
    case "manual":
      return getPublicArticlesByIds(s.article_ids.slice(0, s.limit));
    case "most_read":
      return getMostReadArticles(7, s.limit, s.category_id);
    case "featured":
      return (await listPublicArticles({ featured: true, pageSize: s.limit, withTotal: false })).items;
    case "editors_picks":
      return (await listPublicArticles({ editorsPick: true, pageSize: s.limit, withTotal: false })).items;
    case "breaking":
      return (await listPublicArticles({ breaking: true, pageSize: s.limit, withTotal: false })).items;
    case "category":
      return (await listPublicArticles({ categoryId: s.category_id, pageSize: s.limit, withTotal: false })).items;
    default:
      return (await listPublicArticles({ pageSize: s.limit, withTotal: false })).items;
  }
}

const section = "py-10 md:py-12";

/** Lead story, right rail, and a row of three (Morning "hero"). The lead image is the page's LCP. */
export async function TopStoriesBlock({ settings }: { settings: BlockSettings<"top_stories"> }) {
  const want = 1 + settings.rail_count + settings.below_count;
  const [leadPick, latest] = await Promise.all([
    settings.lead_source === "manual" && settings.lead_article_id
      ? getPublicArticlesByIds([settings.lead_article_id]).then((r) => r[0])
      : settings.lead_source === "featured"
        ? listPublicArticles({ featured: true, pageSize: 1, withTotal: false }).then((r) => r.items[0])
        : Promise.resolve(undefined),
    listPublicArticles({ pageSize: want + 1, withTotal: false }).then((r) => r.items),
  ]);
  const lead = leadPick ?? latest[0];
  if (!lead) {
    return (
      <section className={section}>
        <div className="container-site">
          <EmptyState title="Wala pang nailalathalang balita.">Lalabas dito ang mga pangunahing balita kapag nailathala na ng newsroom.</EmptyState>
        </div>
      </section>
    );
  }
  const rest = latest.filter((a) => a.id !== lead.id);
  const railTop = settings.rail_count > 0 ? rest[0] : undefined;
  const railList = rest.slice(1, settings.rail_count);
  const below = rest.slice(settings.rail_count, settings.rail_count + settings.below_count);

  return (
    <section aria-label="Mga pangunahing balita" className="pb-8 pt-8 md:pb-10 md:pt-10">
      {/* lg: two shared rows (subgrid), so the story row and the rail list start on the same rule. */}
      <div className="container-site grid gap-10 lg:grid-cols-12 lg:gap-x-8">
        <div className="grid content-start gap-10 lg:col-span-8 lg:row-span-2 lg:grid-rows-subgrid">
          <ArticleCard article={lead} variant="feature" priority />
          {below.length > 0 && (
            <div className="grid gap-8 border-t border-line pt-8 sm:grid-cols-3 sm:gap-6">
              {below.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </div>
        {railTop && (
          <aside
            aria-label="Iba pang balita"
            className="grid content-start gap-6 lg:col-span-4 lg:row-span-2 lg:grid-rows-subgrid lg:gap-10 lg:border-l lg:border-line lg:pl-8"
          >
            <ArticleCard article={railTop} />
            {railList.length > 0 && (
              <ul className="space-y-5 self-start border-t border-line pt-6 lg:pt-8">
                {railList.map((a) => (
                  <li key={a.id}>
                    <ArticleCard article={a} variant="compact" />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

function RankedList({ title, articles, note }: { title: string; articles: Article[]; note?: string }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <ol className="mt-5 space-y-5">
        {articles.map((a, i) => (
          <li key={a.id} className="group flex gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-accent text-xs font-bold text-white tabular-nums"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <Link href={`/balita/${a.slug}`} className="min-w-0">
              <span className="line-clamp-3 text-[0.92rem] font-medium leading-snug text-ink group-hover:text-brand">{a.title}</span>
              {a.category && <span className="mt-1 block text-[0.75rem] text-muted">{a.category.name}</span>}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SideTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b-2 border-ink pb-2 text-lg font-semibold text-ink">{children}</h3>;
}

/** Section index: always available, so the sidebar never sits empty before view data exists. */
function TopicIndex({ categories }: { categories: CategorySummary[] }) {
  return (
    <div>
      <SideTitle>Mga Paksa</SideTitle>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/paksa/${c.slug}`} className="group flex min-h-11 items-center justify-between gap-3 py-2 text-[0.95rem] font-medium text-ink hover:text-brand">
              {c.name}
              <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Post = Awaited<ReturnType<typeof listApprovedPosts>>["items"][number];

function CommunityPicks({ posts }: { posts: Post[] }) {
  return (
    <div>
      <SideTitle>Usap Bayan</SideTitle>
      <ul className="divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id} className="py-3.5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-accent">{COMMUNITY_KIND_LABELS[p.kind]}</p>
            <Link href={`/usap-bayan/${p.id}`} className="mt-1 block text-[0.95rem] font-medium leading-snug text-ink hover:text-brand">
              {p.title}
            </Link>
            <p className="mt-1 text-[0.75rem] text-muted">
              {p.author_name}
              {p.author_location ? ` · ${p.author_location}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <Link href="/usap-bayan#magbahagi" className="btn mt-4 min-h-10 w-full border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-white">
        Ibahagi ang iyong boses
      </Link>
    </div>
  );
}

export async function ArticleListBlock({
  title,
  description,
  settings,
  layout = "grid",
  tone = "default",
}: {
  title: string | null;
  description: string | null;
  settings: ListSettings;
  layout?: ListLayout;
  tone?: "default" | "surface";
}) {
  const sidebarWanted = layout === "list" && settings.with_sidebar;
  const [articles, trending, categories, posts] = await Promise.all([
    resolveArticles(settings),
    sidebarWanted ? getMostReadArticles(7, 5) : Promise.resolve([] as Article[]),
    sidebarWanted ? listCategories() : Promise.resolve([] as CategorySummary[]),
    sidebarWanted ? listApprovedPosts({ pageSize: 3, withTotal: false }).then((r) => r.items) : Promise.resolve([] as Post[]),
  ]);
  if (articles.length === 0 && layout !== "list") return null; // Secondary lists hide when empty.
  // Ranking needs real page-view data and is never invented; until it exists the sidebar shows the section index.
  const featured = categories.filter((c) => c.is_featured);
  const topics = (featured.length >= 4 ? featured : categories).slice(0, 8);
  const hasSidebar = sidebarWanted && articles.length > 0 && (trending.length > 0 || topics.length > 0 || posts.length > 0);

  const body =
    articles.length === 0 ? (
      <EmptyState title="Wala pang nailalathalang balita.">Lalabas dito ang mga kwento kapag nailathala na ng newsroom.</EmptyState>
    ) : layout === "list" ? (
      <div className="divide-y divide-line">
        {articles.map((a) => (
          <div key={a.id} className="py-6 first:pt-0 last:pb-0">
            <ArticleCard article={a} variant="list" />
          </div>
        ))}
      </div>
    ) : layout === "side" ? (
      <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} variant="side" />
        ))}
      </div>
    ) : (
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    );

  return (
    <section className={tone === "surface" ? `bg-surface ${section}` : section}>
      <div className="container-site">
        {title && <SectionHeading title={title} description={description} action={settings.view_all} />}
        {hasSidebar ? (
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-8">{body}</div>
            <aside className="space-y-10 lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
              {trending.length > 0 ? (
                <RankedList title="Trending" articles={trending} note="Batay sa pagbisita sa nakalipas na 7 araw." />
              ) : (
                topics.length > 0 && <TopicIndex categories={topics} />
              )}
              {posts.length > 0 && <CommunityPicks posts={posts} />}
            </aside>
          </div>
        ) : (
          body
        )}
      </div>
    </section>
  );
}

export async function FeaturedStoryBlock({ title, settings }: { title: string | null; settings: BlockSettings<"featured_story"> }) {
  let article: Article | undefined;
  if (settings.source === "manual" && settings.article_id) article = (await getPublicArticlesByIds([settings.article_id]))[0];
  else if (settings.source === "featured") article = (await listPublicArticles({ featured: true, pageSize: 1, withTotal: false })).items[0];
  if (!article) article = (await listPublicArticles({ pageSize: 1, withTotal: false })).items[0];
  if (!article) return null;
  return (
    <section className={section}>
      <div className="container-site">
        {title && <SectionHeading title={title} />}
        <ArticleCard article={article} variant="feature" />
      </div>
    </section>
  );
}

export async function BreakingNewsBlock({ settings }: { settings: BlockSettings<"breaking_news"> }) {
  const { items } = await listPublicArticles({ breaking: true, pageSize: settings.limit, withTotal: false });
  if (items.length === 0) return null; // No breaking news → no alarm bar.
  return (
    <section aria-label="Breaking news" className="bg-accent text-white">
      <div className="container-site flex items-center gap-4 overflow-x-auto py-2.5 text-sm [scrollbar-width:none]">
        <span className="shrink-0 rounded-[3px] bg-white px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-accent">Breaking</span>
        <ul className="flex gap-8 whitespace-nowrap">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/balita/${a.slug}`} className="font-medium hover:underline">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Dateline + editorially managed trending topics (Istorya strip under the masthead). */
export async function TrendingTopicsBlock({ title, settings }: { title: string | null; settings: BlockSettings<"trending_topics"> }) {
  const topics = await listTrendingTopics();
  return (
    <section aria-label={title ?? "Trending"} className="border-b border-line bg-white">
      <div className="container-site flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-6">
        <p className="shrink-0 text-[0.8rem] font-medium text-ink-soft">{formatDateline()}</p>
        {topics.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h2 className="inline-flex shrink-0 items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-brand-700">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              {title ?? "Trending"}
            </h2>
            <ul className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
              {topics.map((t) => (
                <li key={t.id} className="shrink-0">
                  <Link
                    href={t.href}
                    className="inline-flex min-h-8 items-center rounded-full border border-line px-3 text-[0.8rem] font-medium text-ink-soft transition-colors hover:border-brand-200 hover:text-brand"
                  >
                    #{t.label.replace(/\s+/g, "")}
                  </Link>
                </li>
              ))}
            </ul>
            {settings.view_all && (
              <Link href={settings.view_all.href} className="hidden shrink-0 text-[0.8rem] font-semibold text-ink hover:text-brand lg:inline">
                {settings.view_all.label} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ColumnHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between border-b-2 border-ink pb-2">
      <h3 className="text-lg font-semibold text-ink">
        <Link href={href} className="hover:text-brand">
          {title}
        </Link>
      </h3>
      <Link href={href} className="text-[0.8rem] font-semibold text-muted hover:text-brand">
        {linkLabel} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export async function CategoryShowcaseBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"category_showcase"> }) {
  const all = await listCategories();
  const chosen = settings.category_ids.length
    ? settings.category_ids.map((id) => all.find((c) => c.id === id)).filter((c) => c !== undefined)
    : all.filter((c) => c.is_featured);
  const groups = await Promise.all(
    chosen.map(async (c) => ({ category: c, items: (await listPublicArticles({ categoryId: c.id, pageSize: settings.per_category, withTotal: false })).items })),
  );
  // Default selection: the first three featured sections that actually have stories.
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  const filled = settings.category_ids.length ? nonEmpty.slice(0, 8) : [...nonEmpty].sort((a, b) => b.items.length - a.items.length).slice(0, 3);
  if (filled.length === 0) return null;
  return (
    <section className={section}>
      <div className="container-site">
        {title && <SectionHeading title={title} description={description} />}
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {filled.map(({ category, items }) => (
            <div key={category.id}>
              <ColumnHead title={category.name} href={`/paksa/${category.slug}`} linkLabel="Lahat" />
              <div className="space-y-5">
                <ArticleCard article={items[0]} />
                {items.slice(1).map((a) => (
                  <ArticleCard key={a.id} article={a} variant="compact" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export async function MostReadBlock({ title, settings }: { title: string | null; settings: BlockSettings<"most_read"> }) {
  const items = await getMostReadArticles(settings.days, settings.limit);
  if (items.length === 0) return null; // Ranking needs real page-view data; never invent one.
  return (
    <section className={section}>
      <div className="container-site">
        <SectionHeading title={title ?? "Pinakabinabasa"} description={`Batay sa mga pagbisita sa nakalipas na ${settings.days} araw.`} />
        <ol className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {items.map((a, i) => (
            <li key={a.id} className="flex gap-4">
              <span className="text-3xl font-semibold leading-none text-accent tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ArticleCard article={a} variant="compact" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Island groups with their regions as chips, then the latest stories from each (Istorya "Interactive Philippines"). */
export async function RegionalNewsBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"regional_news"> }) {
  const locations = await listLocations();
  const chosen = settings.location_ids.length
    ? settings.location_ids.map((id) => locations.find((l) => l.id === id)).filter((l) => l !== undefined)
    : locations.filter((l) => l.kind === "island_group");
  const groups = await Promise.all(
    chosen.map(async (loc) => {
      const ids = [loc.id];
      for (let i = 0; i < ids.length; i++) for (const c of locations) if (c.parent_id === ids[i]) ids.push(c.id);
      const children = locations.filter((c) => c.parent_id === loc.id);
      return { loc, children, items: (await listPublicArticles({ locationIds: ids, pageSize: settings.per_location, withTotal: false })).items };
    }),
  );
  if (groups.length === 0) return null;
  return (
    <section className={`bg-surface ${section}`}>
      <div className="container-site">
        <SectionHeading title={title ?? "Balitang Rehiyon"} description={description} />
        {/* md+: each column spans three shared rows (head, region chips, stories), so story lists start level however the chips wrap. */}
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
          {groups.map(({ loc, children, items }) => (
            <div key={loc.id} className="md:row-span-3 md:grid md:grid-rows-subgrid md:gap-y-0">
              <ColumnHead title={loc.name} href={`/rehiyon/${loc.slug}`} linkLabel="Lahat" />
              {children.length > 0 ? (
                <ul className="mb-6 flex flex-wrap content-start gap-2" aria-label={`Mga rehiyon sa ${loc.name}`}>
                  {children.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/rehiyon/${c.slug}`}
                        className="inline-flex min-h-8 items-center rounded-full border border-line bg-white px-3 text-[0.78rem] font-medium text-ink-soft transition-colors hover:border-brand-200 hover:text-brand"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div />
              )}
              {items.length ? (
                <div className="space-y-5 self-start">
                  {items.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="compact" />
                  ))}
                </div>
              ) : (
                <p className="self-start text-sm text-muted">Wala pang balita mula sa {loc.name}.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
