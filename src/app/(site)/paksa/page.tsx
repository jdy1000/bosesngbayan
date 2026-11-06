import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/public/article-card";
import { listCategories, listLocations } from "@/lib/cms/site";
import { mediaUrl } from "@/lib/media";
import { buildMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return buildMetadata({ title: t.common.topics.metaTitle, description: t.common.topics.metaDescription, path: "/paksa" });
}

export default async function TopicsPage() {
  const [categories, locations, { t }] = await Promise.all([listCategories(), listLocations(), getI18n()]);
  const regions = locations.filter((l) => l.kind === "island_group" || l.kind === "region");

  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-10 max-w-3xl">
        <h1 className="text-4xl font-semibold text-ink md:text-5xl">{t.common.topics.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{t.common.topics.intro}</p>
      </header>
      {categories.length === 0 ? (
        <EmptyState title={t.common.topics.empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const src = mediaUrl(c.image);
            return (
              <li key={c.id}>
                <Link href={`/paksa/${c.slug}`} className="card group flex h-full items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-float)]">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-100">
                    {src ? (
                      <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-2xl font-semibold text-brand-700" aria-hidden="true">
                        {c.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-ink group-hover:text-brand">{c.name}</h2>
                    {c.description && <p className="line-clamp-2 text-sm text-ink-soft">{c.description}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {regions.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-semibold text-ink">{t.common.topics.byRegion}</h2>
          <ul className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <li key={r.id}>
                <Link href={`/rehiyon/${r.slug}`} className={`chip ${r.kind === "island_group" ? "font-bold" : ""}`}>
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
