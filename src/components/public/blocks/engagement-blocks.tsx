import Image from "next/image";
import Link from "next/link";
import { ChartColumnBig, Heart, Megaphone, MessagesSquare, Newspaper, ShieldCheck, Users, Vote, type LucideIcon } from "lucide-react";
import { EmptyState, SectionHeading } from "@/components/public/article-card";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { PollWidget } from "@/components/public/poll-widget";
import type { BlockSettings } from "@/lib/homepage/blocks";
import { getPublicPollById, isPollOpen, listPublicPolls } from "@/lib/cms/polls";
import { COMMUNITY_KIND_LABELS, listApprovedPosts } from "@/lib/cms/community";
import { getMediaById, getSiteSettings } from "@/lib/cms/site";
import { timeAgo, truncate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { getLocale, getI18n } from "@/lib/i18n/server";
import { localizeSettings } from "@/lib/settings/schema";

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

/** Counting rules and the other polls, set on the brand band (white text; the band is brand-coloured in both themes). */
async function PollSidePanel({ others }: { others: Awaited<ReturnType<typeof listPublicPolls>> }) {
  const { t } = await getI18n();
  return (
    <aside className="space-y-8 border-t border-white/25 pt-8">
      <div>
        <h3 className="text-base font-bold">{t.blocks.howVotesCount}</h3>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-white/85">{t.blocks.howVotesCountBody}</p>
        <Link href="/botohan#metodolohiya" className="mt-3 inline-block border-b border-white/70 pb-0.5 text-sm font-semibold hover:border-white">
          {t.blocks.readMethodology} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {others.length > 0 && (
        <div>
          <h3 className="text-base font-bold">{t.blocks.otherPolls}</h3>
          <ul className="mt-1 divide-y divide-white/20">
            {others.map((p) => (
              <li key={p.id}>
                <Link href={`/botohan/${p.slug}`} className="group block py-3">
                  <span className={`text-[0.7rem] font-bold uppercase tracking-[0.08em] ${isPollOpen(p) ? "text-sun" : "text-white/80"}`}>
                    {isPollOpen(p) ? t.blocks.pollOpen : t.blocks.pollClosed}
                  </span>
                  <span className="mt-0.5 block text-[0.95rem] font-semibold leading-snug group-hover:underline">{p.question}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/** The ballot is the one white object on the band, lifted with a soft shadow. */
function Ballot({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md text-ink shadow-[0_28px_56px_-28px_rgb(0_0_0/0.6)]">{children}</div>;
}

export async function PollShowcaseBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"poll_showcase"> }) {
  const [primary, active, recent, { t }] = await Promise.all([
    settings.poll_id ? getPublicPollById(settings.poll_id) : Promise.resolve(null),
    settings.show_active_list ? listPublicPolls("active", settings.limit + 1) : Promise.resolve([]),
    listPublicPolls("all", 6),
    getI18n(),
  ]);
  const polls = [primary, ...active.filter((p) => p.id !== primary?.id)].filter((p) => p !== null).slice(0, settings.limit);
  if (polls.length === 0 && !settings.show_active_list) return null; // A single-poll module with no open poll stays out of the way.
  // The page's one loud moment: a full-bleed brand band, so voting and Usap Bayan read as the community half of the site.
  const intro = (
    <div className="max-w-xl">
      <p className="flex items-center gap-3 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-sun">
        <span aria-hidden="true" className="h-0.5 w-8 bg-sun" />
        {t.blocks.bandKicker}
      </p>
      <h2 className="mt-4 text-[2.25rem] font-bold leading-[1.05] tracking-[-0.025em] md:text-[3rem]">{title ?? t.blocks.polls}</h2>
      <p className="mt-4 text-lg leading-relaxed text-white/90">{description ?? t.blocks.bandPitch}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/usap-bayan#magbahagi" className="btn btn-light">
          {t.blocks.shareVoice}
        </Link>
        <Link href="/botohan" className="border-b border-white/70 pb-0.5 text-sm font-semibold hover:border-white">
          {t.blocks.allPolls} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
  return (
    <section data-flush-footer className="bg-brand py-14 text-white md:py-20">
      <div className="container-site">
        {polls.length === 1 ? (
          // Phones: intro, ballot, details. lg: text stacked on the left, the ballot spanning both rows on the right.
          <div className="grid gap-x-14 gap-y-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">{intro}</div>
            <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
              <Ballot>
                <PollWidget poll={polls[0]} />
              </Ballot>
            </div>
            <div className="lg:col-span-5">
              <PollSidePanel others={recent.filter((p) => p.id !== polls[0].id).slice(0, 4)} />
            </div>
          </div>
        ) : (
          <>
            {intro}
            <div className="mt-10">
              {polls.length ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {polls.map((p) => (
                    <Ballot key={p.id}>
                      <PollWidget poll={p} />
                    </Ballot>
                  ))}
                </div>
              ) : (
                <EmptyState title={t.blocks.noOpenPollsTitle}>{t.blocks.noOpenPollsBody}</EmptyState>
              )}
            </div>
            <p className="mt-6 text-sm text-white/85">
              {t.blocks.pollCaveat}{" "}
              <Link href="/botohan#metodolohiya" className="border-b border-white/70 pb-0.5 font-semibold hover:border-white">
                {t.blocks.learnHowCounted}
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export async function CommunityBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"community"> }) {
  const [{ items }, { locale, t }] = await Promise.all([
    listApprovedPosts({ featuredOnly: settings.featured_only, pageSize: settings.limit, withTotal: false }),
    getI18n(),
  ]);
  return (
    <section className="py-14 md:py-18">
      <div className="container-site">
        <SectionHeading title={title ?? "Usap Bayan"} description={description} action={settings.cta} />
        {items.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <article key={p.id} className="card group relative flex flex-col p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{COMMUNITY_KIND_LABELS[locale][p.kind]}</p>
                <h3 className="mt-2 text-lg font-semibold leading-snug text-ink group-hover:text-brand">
                  <Link href={`/usap-bayan/${p.id}`} className="after:absolute after:inset-0">
                    {p.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-[0.95rem] text-ink-soft">{truncate(p.body, 220)}</p>
                <p className="mt-auto pt-4 text-sm text-muted">
                  {p.author_name}
                  {p.author_location ? ` · ${p.author_location}` : ""} · {timeAgo(p.published_at, undefined, locale)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={t.blocks.communityEmptyTitle}>
            <Link href="/usap-bayan#magbahagi" className="font-semibold text-brand hover:underline">
              {t.blocks.communityEmptyCta}
            </Link>
          </EmptyState>
        )}
      </div>
    </section>
  );
}

export async function NewsletterBlock({ title, description, settings }: { title: string | null; description: string | null; settings: BlockSettings<"newsletter"> }) {
  const site = localizeSettings(await getSiteSettings(), await getLocale());
  if (!site.newsletter.enabled) return null;
  return (
    <section className="bg-brand-50 py-12 md:py-16">
      <div className="container-site grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="flex items-center gap-3 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-accent-700">
            <span aria-hidden="true" className="h-0.5 w-8 bg-accent" />
            Newsletter
          </p>
          <h2 className="mt-3 text-[1.9rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink md:text-[2.5rem]">{title ?? site.footer.newsletter_title}</h2>
          {(description ?? site.footer.newsletter_description) && (
            <p className="mt-3 max-w-md text-[1.05rem] text-ink-soft">{description ?? site.footer.newsletter_description}</p>
          )}
        </div>
        <NewsletterForm consentText={site.newsletter.consent_text} source={settings.source || "homepage"} />
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
