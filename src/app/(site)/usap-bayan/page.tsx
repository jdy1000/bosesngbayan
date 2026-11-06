import Link from "next/link";
import { EmptyState } from "@/components/public/article-card";
import { parsePage } from "@/components/public/article-list-page";
import { SubmissionForm } from "@/components/public/submission-form";
import { COMMUNITY_KIND_LABELS, listApprovedPosts, type CommunityKind } from "@/lib/cms/community";
import { getSiteSettings, listCategories } from "@/lib/cms/site";
import { timeAgo, truncate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<{ page?: string; uri?: string }> };

export function generateMetadata() {
  return buildMetadata({ title: "Usap Bayan", description: "Mga pananaw at tanong mula sa komunidad.", path: "/usap-bayan" });
}

export default async function CommunityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const kind = sp.uri && sp.uri in COMMUNITY_KIND_LABELS ? (sp.uri as CommunityKind) : undefined;
  const page = parsePage(sp.page);
  const [settings, categories, featured, list] = await Promise.all([
    getSiteSettings(),
    listCategories(),
    page === 1 && !kind ? listApprovedPosts({ featuredOnly: true, pageSize: 2 }) : Promise.resolve(null),
    listApprovedPosts({ kind, page, pageSize: 12 }),
  ]);
  const featuredIds = new Set(featured?.items.map((p) => p.id));
  const items = list.items.filter((p) => !featuredIds.has(p.id));

  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-8 max-w-3xl">
        <h1 className="text-4xl font-semibold text-ink md:text-5xl">Usap Bayan</h1>
        <p className="mt-3 text-lg text-ink-soft">Pakinggan ang kapwa. Ibahagi ang iyong pananaw. Magtanong sa komunidad.</p>
      </header>

      {featured && featured.items.length > 0 && (
        <section aria-label="Tampok na talakayan" className="mb-12 grid gap-6 md:grid-cols-2">
          {featured.items.map((p) => (
            <article key={p.id} className="relative rounded-md bg-navy p-7 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">Tampok · {COMMUNITY_KIND_LABELS[p.kind]}</p>
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

      <nav aria-label="Uri" className="mb-6 flex flex-wrap gap-2">
        <Link href="/usap-bayan" className="chip" data-active={!kind || undefined} aria-current={!kind ? "page" : undefined}>
          Lahat
        </Link>
        {(Object.keys(COMMUNITY_KIND_LABELS) as CommunityKind[]).map((k) => (
          <Link key={k} href={`/usap-bayan?uri=${k}`} className="chip" aria-current={kind === k ? "page" : undefined}>
            {COMMUNITY_KIND_LABELS[k]}
          </Link>
        ))}
      </nav>

      <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label="Mga talakayan">
          {items.length === 0 ? (
            <EmptyState title="Wala pang naaprubahang talakayan dito.">Ibahagi ang iyong pananaw gamit ang form.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {items.map((p) => (
                <li key={p.id}>
                  <article className="card relative p-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-accent">
                      {COMMUNITY_KIND_LABELS[p.kind]}
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
                      {p.author_location ? ` · ${p.author_location}` : ""} · {timeAgo(p.published_at)}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {list.totalPages > 1 && (
            <nav aria-label="Mga pahina" className="mt-8 flex items-center justify-between text-sm">
              {page > 1 ? <Link className="btn btn-outline" href={`/usap-bayan?${new URLSearchParams({ ...(kind ? { uri: kind } : {}), page: String(page - 1) })}`}>← Nauna</Link> : <span />}
              <span className="text-muted">Pahina {page} ng {list.totalPages}</span>
              {page < list.totalPages ? <Link className="btn btn-outline" href={`/usap-bayan?${new URLSearchParams({ ...(kind ? { uri: kind } : {}), page: String(page + 1) })}`}>Susunod →</Link> : <span />}
            </nav>
          )}
        </section>

        <aside id="magbahagi" aria-labelledby="submit-heading" className="h-fit rounded-md border border-line p-6 lg:sticky lg:top-32">
          <h2 id="submit-heading" className="text-2xl font-semibold text-ink">Ibahagi ang iyong boses</h2>
          {settings.community.submissions_enabled ? (
            <div className="mt-4">
              <SubmissionForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} guidelines={settings.community.guidelines} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Pansamantalang sarado ang pagsusumite ng bagong talakayan.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
