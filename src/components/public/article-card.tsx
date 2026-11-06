import Image from "next/image";
import Link from "next/link";
import type { ArticleCard as Article } from "@/lib/cms/articles";
import { formatDate, timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

type Variant = "grid" | "list" | "feature" | "compact";

function Thumb({ article, sizes, className, priority }: { article: Article; sizes: string; className: string; priority?: boolean }) {
  const src = mediaUrl(article.image);
  if (!src) {
    // No image: a quiet brand field with the category, never a stock placeholder photo.
    return (
      <div className={`${className} flex items-end bg-gradient-to-br from-brand-100 to-surface-2 p-4`} aria-hidden="true">
        <span className="font-serif text-lg font-semibold text-brand-700/70">{article.category?.name ?? "Balita"}</span>
      </div>
    );
  }
  return (
    <div className={`${className} relative overflow-hidden bg-surface-2`}>
      <Image
        src={src}
        alt={article.image?.alt_text ?? ""}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
    </div>
  );
}

function Meta({ article, showAuthor = true }: { article: Article; showAuthor?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted">
      {showAuthor && article.author && <span className="font-semibold text-ink-soft">{article.author.display_name}</span>}
      {showAuthor && article.author && <span aria-hidden="true">·</span>}
      {article.published_at && (
        <time dateTime={article.published_at} title={formatDate(article.published_at)}>
          {timeAgo(article.published_at)}
        </time>
      )}
      {article.reading_minutes > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{article.reading_minutes} min basa</span>
        </>
      )}
    </p>
  );
}

function Labels({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {article.is_breaking && <span className="category-badge bg-accent text-white">Breaking</span>}
      {article.category && <span className="category-badge">{article.category.name}</span>}
    </div>
  );
}

export function ArticleCard({ article, variant = "grid", priority }: { article: Article; variant?: Variant; priority?: boolean }) {
  const href = `/balita/${article.slug}`;

  if (variant === "compact") {
    return (
      <article className="group">
        <Link href={href} className="flex gap-4 rounded-xl">
          <Thumb article={article} sizes="96px" className="aspect-square w-24 shrink-0 rounded-xl" />
          <div className="min-w-0 space-y-1.5">
            {article.category && <p className="text-xs font-bold uppercase tracking-wide text-brand">{article.category.name}</p>}
            <h3 className="line-clamp-3 font-serif text-[1.05rem] font-semibold leading-snug text-ink group-hover:text-brand">{article.title}</h3>
            <Meta article={article} showAuthor={false} />
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "list") {
    return (
      <article className="group">
        <Link href={href} className="grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr] sm:gap-6">
          <Thumb article={article} sizes="(min-width: 640px) 240px, 100vw" className="aspect-[16/10] w-full rounded-[var(--radius-card)]" />
          <div className="space-y-2.5">
            <Labels article={article} />
            <h3 className="font-serif text-xl font-semibold leading-snug text-ink group-hover:text-brand md:text-[1.4rem]">{article.title}</h3>
            {article.excerpt && <p className="line-clamp-2 text-[0.95rem] text-ink-soft">{article.excerpt}</p>}
            <Meta article={article} />
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "feature") {
    return (
      <article className="group">
        <Link href={href} className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-10">
          <Thumb
            article={article}
            priority={priority}
            sizes="(min-width: 1024px) 640px, 100vw"
            className="aspect-[16/10] w-full rounded-[var(--radius-card)]"
          />
          <div className="space-y-4">
            <Labels article={article} />
            <h3 className="font-serif text-3xl font-bold leading-[1.12] text-ink group-hover:text-brand md:text-[2.4rem]">{article.title}</h3>
            {article.excerpt && <p className="text-lg text-ink-soft">{article.excerpt}</p>}
            <Meta article={article} />
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group card flex flex-col overflow-hidden">
      <Link href={href} className="flex h-full flex-col">
        <Thumb article={article} priority={priority} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="aspect-[16/10] w-full" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <Labels article={article} />
          <h3 className="font-serif text-[1.3rem] font-semibold leading-snug text-ink group-hover:text-brand">{article.title}</h3>
          {article.excerpt && <p className="line-clamp-3 text-[0.95rem] text-ink-soft">{article.excerpt}</p>}
          <div className="mt-auto pt-1">
            <Meta article={article} />
          </div>
        </div>
      </Link>
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-serif text-xl font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[0.95rem] text-ink-soft">{children}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  as: Tag = "h2",
  tone = "default",
}: {
  title: string;
  description?: string | null;
  action?: { label: string; href: string } | null;
  as?: "h1" | "h2";
  tone?: "default" | "light";
}) {
  const light = tone === "light";
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="section-kicker max-w-2xl">
        <Tag className={`font-serif text-3xl font-bold leading-tight md:text-[2.25rem] ${light ? "text-white" : "text-ink"}`}>{title}</Tag>
        {description && <p className={`mt-2 text-[1.05rem] ${light ? "text-white/80" : "text-ink-soft"}`}>{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className={`text-[0.95rem] font-bold ${light ? "text-white" : "text-brand"} hover:underline`}>
          {action.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
