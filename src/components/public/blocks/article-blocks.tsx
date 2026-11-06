import Link from "next/link";
import { ArticleCard, EmptyState, SectionHeading } from "@/components/public/article-card";
import type { BlockSettings } from "@/lib/homepage/blocks";
import {
  getMostReadArticles,
  getPublicArticlesByIds,
  listPublicArticles,
  type ArticleCard as Article,
} from "@/lib/cms/articles";
import { listCategories, listLocations, listTrendingTopics } from "@/lib/cms/site";

type ListSettings = BlockSettings<"article_grid">;

/** Resolves an article-list block's configured source to published articles only. */
async function resolveArticles(s: ListSettings): Promise<Article[]> {
  switch (s.source) {
    case "manual":
      return getPublicArticlesByIds(s.article_ids.slice(0, s.limit));
    case "most_read":
      return getMostReadArticles(7, s.limit, s.category_id);
    case "featured":
      return (await listPublicArticles({ featured: true, pageSize: s.limit })).items;
    case "editors_picks":
      return (await listPublicArticles({ editorsPick: true, pageSize: s.limit })).items;
    case "breaking":
      return (await listPublicArticles({ breaking: true, pageSize: s.limit })).items;
    case "category":
      return (await listPublicArticles({ categoryId: s.category_id, pageSize: s.limit })).items;
    default:
      return (await listPublicArticles({ pageSize: s.limit })).items;
  }
}

function Grid({ articles }: { articles: Article[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a, i) => (
        <ArticleCard key={a.id} article={a} priority={i === 0} />
      ))}
    </div>
  );
}

export async function ArticleListBlock({
  title,
  description,
  settings,
  tone = "default",
}: {
  title: string | null;
  description: string | null;
  settings: ListSettings;
  tone?: "default" | "surface";
}) {
  const articles = await resolveArticles(settings);
  return (
    <section className={tone === "surface" ? "bg-surface py-14 md:py-18" : "py-14 md:py-18"}>
      <div className="container-site">
        {title && <SectionHeading title={title} description={description} action={settings.view_all} />}
        {articles.length > 0 ? (
          <Grid articles={articles} />
        ) : (
          <EmptyState title="Wala pang nailalathalang balita.">Lalabas dito ang mga kwento kapag nailathala na ng newsroom.</EmptyState>
        )}
      </div>
    </section>
  );
}

export async function FeaturedStoryBlock({ title, settings }: { title: string | null; settings: BlockSettings<"featured_story"> }) {
  let article: Article | undefined;
  if (settings.source === "manual" && settings.article_id) article = (await getPublicArticlesByIds([settings.article_id]))[0];
  else if (settings.source === "featured") article = (await listPublicArticles({ featured: true, pageSize: 1 })).items[0];
  if (!article) article = (await listPublicArticles({ pageSize: 1 })).items[0];
  if (!article) return null;
  return (
    <section className="py-12 md:py-16">
      <div className="container-site">
        {title && <SectionHeading title={title} />}
        <ArticleCard article={article} variant="feature" priority />
      </div>
    </section>
  );
}

export async function BreakingNewsBlock({ settings }: { settings: BlockSettings<"breaking_news"> }) {
  const { items } = await listPublicArticles({ breaking: true, pageSize: settings.limit });
  if (items.length === 0) return null; // No breaking news → no alarm bar.
  return (
    <section aria-label="Breaking news" className="bg-accent text-white">
      <div className="container-site flex items-center gap-4 overflow-x-auto py-3 text-sm [scrollbar-width:none]">
        <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-accent">Breaking</span>
        <ul className="flex gap-8 whitespace-nowrap">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/balita/${a.slug}`} className="font-semibold hover:underline">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function TrendingTopicsBlock({ title, settings }: { title: string | null; settings: BlockSettings<"trending_topics"> }) {
  const topics = await listTrendingTopics();
  if (topics.length === 0) return null;
  return (
    <section aria-label={title ?? "Trending topics"} className="border-y border-line bg-white">
      <div className="container-site flex items-center gap-4 py-4">
        {title && <h2 className="shrink-0 text-sm font-bold text-navy">{title}</h2>}
        <ul className="-my-1 flex flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          {topics.map((t) => (
            <li key={t.id} className="shrink-0">
              <Link href={t.href} className="chip">
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
        {settings.view_all && (
          <Link href={settings.view_all.href} className="hidden shrink-0 text-sm font-bold text-brand hover:underline md:inline">
            {settings.view_all.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </section>
  );
}

export async function CategoryShowcaseBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"category_showcase"> }) {
  const all = await listCategories();
  const chosen = settings.category_ids.length
    ? settings.category_ids.map((id) => all.find((c) => c.id === id)).filter((c) => c !== undefined)
    : all.filter((c) => c.is_featured).slice(0, 3);
  const groups = await Promise.all(
    chosen.map(async (c) => ({ category: c, items: (await listPublicArticles({ categoryId: c.id, pageSize: settings.per_category })).items })),
  );
  const filled = groups.filter((g) => g.items.length > 0);
  if (filled.length === 0) return null;
  return (
    <section className="py-14 md:py-18">
      <div className="container-site">
        {title && <SectionHeading title={title} description={description} />}
        <div className="grid gap-10 lg:grid-cols-3">
          {filled.map(({ category, items }) => (
            <div key={category.id}>
              <div className="mb-5 flex items-baseline justify-between border-b-2 border-navy pb-2">
                <h3 className="font-serif text-xl font-bold text-navy">{category.name}</h3>
                <Link href={`/paksa/${category.slug}`} className="text-sm font-bold text-brand hover:underline">
                  Lahat
                </Link>
              </div>
              <div className="space-y-5">
                {items.map((a) => (
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
    <section className="bg-surface py-14 md:py-18">
      <div className="container-site">
        <SectionHeading title={title ?? "Pinakabinabasa"} description={`Batay sa mga pagbisita sa nakalipas na ${settings.days} araw.`} />
        <ol className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {items.map((a, i) => (
            <li key={a.id} className="flex gap-4">
              <span className="font-serif text-4xl font-bold leading-none text-brand-200 tabular-nums" aria-hidden="true">
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

export async function RegionalNewsBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"regional_news"> }) {
  const locations = await listLocations();
  const chosen = settings.location_ids.length
    ? settings.location_ids.map((id) => locations.find((l) => l.id === id)).filter((l) => l !== undefined)
    : locations.filter((l) => l.kind === "island_group");
  const groups = await Promise.all(
    chosen.map(async (loc) => {
      const ids = [loc.id];
      for (let i = 0; i < ids.length; i++) for (const c of locations) if (c.parent_id === ids[i]) ids.push(c.id);
      return { loc, items: (await listPublicArticles({ locationIds: ids, pageSize: settings.per_location })).items };
    }),
  );
  return (
    <section className="py-14 md:py-18">
      <div className="container-site">
        <SectionHeading title={title ?? "Balitang Rehiyon"} description={description} />
        <div className="grid gap-10 lg:grid-cols-3">
          {groups.map(({ loc, items }) => (
            <div key={loc.id}>
              <div className="mb-5 flex items-baseline justify-between border-b-2 border-brand pb-2">
                <h3 className="font-serif text-xl font-bold text-navy">{loc.name}</h3>
                <Link href={`/rehiyon/${loc.slug}`} className="text-sm font-bold text-brand hover:underline">
                  Lahat
                </Link>
              </div>
              {items.length ? (
                <div className="space-y-5">
                  {items.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="compact" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Wala pang balita mula sa {loc.name}.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
