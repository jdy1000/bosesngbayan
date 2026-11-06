import Image from "next/image";
import Link from "next/link";
import { ChartColumnBig, Heart, Megaphone, MessagesSquare, Newspaper, ShieldCheck, Users, Vote, type LucideIcon } from "lucide-react";
import { EmptyState, SectionHeading } from "@/components/public/article-card";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { PollWidget } from "@/components/public/poll-widget";
import type { BlockSettings } from "@/lib/homepage/blocks";
import { getPublicPollById, listPublicPolls } from "@/lib/cms/polls";
import { COMMUNITY_KIND_LABELS, listApprovedPosts } from "@/lib/cms/community";
import { getMediaById, getSiteSettings } from "@/lib/cms/site";
import { timeAgo, truncate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

const ICONS: Record<BlockSettings<"custom_cta">["items"][number]["icon"], LucideIcon> = {
  chart: ChartColumnBig,
  messages: MessagesSquare,
  users: Users,
  megaphone: Megaphone,
  vote: Vote,
  newspaper: Newspaper,
  heart: Heart,
  shield: ShieldCheck,
};

export async function PollShowcaseBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"poll_showcase"> }) {
  const [primary, active] = await Promise.all([
    settings.poll_id ? getPublicPollById(settings.poll_id) : Promise.resolve(null),
    settings.show_active_list ? listPublicPolls("active", settings.limit + 1) : Promise.resolve([]),
  ]);
  const polls = [primary, ...active.filter((p) => p.id !== primary?.id)].filter((p) => p !== null).slice(0, settings.limit);
  if (polls.length === 0 && !settings.show_active_list) return null; // A single-poll module with no open poll stays out of the way.
  return (
    <section className="py-12 md:py-16">
      <div className="container-site">
        <SectionHeading title={title ?? "Mga Botohan"} description={description} action={{ label: "Lahat ng botohan", href: "/botohan" }} />
        {polls.length === 1 ? (
          <div className="max-w-2xl">
            <PollWidget poll={polls[0]} />
          </div>
        ) : polls.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {polls.map((p) => (
              <PollWidget key={p.id} poll={p} />
            ))}
          </div>
        ) : (
          <EmptyState title="Walang bukas na botohan ngayon.">Bumalik muli—maglalabas ang newsroom ng bagong tanong.</EmptyState>
        )}
        <p className="mt-6 text-sm text-muted">
          Ang mga online poll ay boluntaryo at hindi kumakatawan sa buong populasyon ng Pilipinas.{" "}
          <Link href="/botohan#metodolohiya" className="font-semibold text-brand hover:underline">
            Alamin kung paano binibilang
          </Link>
        </p>
      </div>
    </section>
  );
}

export async function CommunityBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"community"> }) {
  const { items } = await listApprovedPosts({ featuredOnly: settings.featured_only, pageSize: settings.limit });
  return (
    <section className="py-14 md:py-18">
      <div className="container-site">
        <SectionHeading title={title ?? "Usap Bayan"} description={description} action={settings.cta} />
        {items.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <article key={p.id} className="card group relative flex flex-col p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{COMMUNITY_KIND_LABELS[p.kind]}</p>
                <h3 className="mt-2 text-lg font-semibold leading-snug text-ink group-hover:text-brand">
                  <Link href={`/usap-bayan/${p.id}`} className="after:absolute after:inset-0">
                    {p.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-[0.95rem] text-ink-soft">{truncate(p.body, 220)}</p>
                <p className="mt-auto pt-4 text-sm text-muted">
                  {p.author_name}
                  {p.author_location ? ` · ${p.author_location}` : ""} · {timeAgo(p.published_at)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Wala pang naaprubahang pananaw.">
            <Link href="/usap-bayan#magbahagi" className="font-semibold text-brand hover:underline">
              Ikaw ang mauna—ibahagi ang iyong pananaw.
            </Link>
          </EmptyState>
        )}
      </div>
    </section>
  );
}

export async function NewsletterBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"newsletter"> }) {
  const site = await getSiteSettings();
  if (!site.newsletter.enabled) return null;
  return (
    <section className="py-12 md:py-16">
      <div className="container-site">
        <div className="grid items-center gap-8 border-t-[3px] border-accent bg-white p-8 shadow-[var(--shadow-card)] md:p-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="category-badge text-accent">Newsletter</p>
            <h2 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-ink md:text-[2rem]">{title ?? site.footer.newsletter_title}</h2>
            {(description ?? site.footer.newsletter_description) && (
              <p className="mt-3 text-[1rem] text-ink-soft">{description ?? site.footer.newsletter_description}</p>
            )}
          </div>
          <NewsletterForm consentText={site.newsletter.consent_text} source={settings.source || "homepage"} />
        </div>
      </div>
    </section>
  );
}

export async function CustomCtaBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"custom_cta"> }) {
  const image = await getMediaById(settings.image_id);
  const src = mediaUrl(image);
  const lines = (title ?? "").split("\n");

  if (settings.variant === "banner") {
    return (
      <section className="py-10 md:py-14">
        <div className="container-site">
          <div className="relative isolate overflow-hidden rounded-md bg-navy px-8 py-12 text-white md:px-14 md:py-16">
            {src && (
              <Image src={src} alt="" fill sizes="(min-width: 1200px) 1136px, 100vw" className="-z-10 object-cover opacity-30" />
            )}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-brand/60" aria-hidden="true" />
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-4xl font-semibold leading-[1.08] md:text-5xl">
                  {lines.map((l, i) => (
                    <span key={i} className="block">
                      {l}
                    </span>
                  ))}
                </h2>
                {description && <p className="mt-4 text-lg text-white/80">{description}</p>}
              </div>
              {settings.cta && (
                <Link href={settings.cta.href} className="btn btn-light h-13 shrink-0 px-8 text-base">
                  {settings.cta.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (settings.variant === "feature_tiles") {
    return (
      <section className="bg-surface py-14 md:py-18">
        <div className="container-site grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:items-center">
          <div className="section-kicker">
            <h2 className="text-3xl font-semibold leading-tight text-ink md:text-[2.4rem]">{title}</h2>
            {description && <p className="mt-3 text-lg text-ink-soft">{description}</p>}
            {settings.cta && (
              <Link href={settings.cta.href} className="btn btn-primary mt-6">
                {settings.cta.label}
              </Link>
            )}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {settings.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.label} className="card flex items-center gap-4 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="font-semibold leading-snug text-ink">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <div className="container-site flex flex-col items-start gap-5 rounded-md border border-line p-8 md:flex-row md:items-center md:justify-between">
        <div>
          {title && <h2 className="text-2xl font-semibold text-ink md:text-3xl">{title}</h2>}
          {description && <p className="mt-2 text-ink-soft">{description}</p>}
        </div>
        {settings.cta && (
          <Link href={settings.cta.href} className="btn btn-primary shrink-0">
            {settings.cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
