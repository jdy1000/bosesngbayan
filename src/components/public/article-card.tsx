import Image from "next/image";
import Link from "next/link";
import type { ArticleCard as Article } from "@/lib/cms/articles";
import { formatDate, timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

/**
 * Story cards (news-first layout, Morning/Istorya references — docs/DESIGN_SYSTEM.md).
 * grid: image over headline · list: image left, excerpt · feature: lead story, text beside a large image ·
 * compact: small thumb left · side: headline left, thumb right.
 */
type Variant = "grid" | "list" | "feature" | "compact" | "side";

function Thumb({
  article,
  sizes,
  className,
  priority,
}: {
  article: Article;
  sizes: string;
  className: string;
  priority?: boolean;
}) {
  const src = mediaUrl(article.image);
  if (!src) {
    // No image: a quiet brand field with the category, never a stock placeholder photo.
    return (
      <div className={`${className} flex items-end bg-gradient-to-br from-brand-100 to-surface-2 p-3`} aria-hidden="true">
        <span className="text-sm font-semibold text-brand-700/70">{article.category?.name ?? "Balita"}</span>
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
        preload={priority}
        fetchPriority={priority ? "high" : undefined}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
    </div>
  );
}

function Meta({
  article,
  showAuthor = true,
  showCategory = false,
  showReading = true,
}: {
  article: Article;
  showAuthor?: boolean;
  showCategory?: boolean;
  showReading?: boolean;
}) {
  const parts: { key: string; node: React.ReactNode; wide?: boolean }[] = [];
  if (showCategory && article.category) parts.push({ key: "c", node: <span className="font-medium text-brand-700">{article.category.name}</span> });
  if (showAuthor && article.author) parts.push({ key: "a", node: <span className="font-medium text-ink-soft">{article.author.display_name}</span> });
  if (article.published_at)
    parts.push({
      key: "t",
      node: (
        <time dateTime={article.published_at} title={formatDate(article.published_at)}>
          {timeAgo(article.published_at)}
        </time>
      ),
    });
  // Reading time is secondary: hidden on phones so narrow rows stay on one or two lines.
  if (showReading && article.reading_minutes > 0) parts.push({ key: "r", node: <span>{article.reading_minutes} min basa</span>, wide: true });
  return (
    // Each item carries its own "·" in a left gutter that the wrapper clips, so a wrapped line starts flush left.
    <div className="overflow-hidden">
      <p className="-ml-3 flex flex-wrap items-center gap-y-0.5 text-[0.78rem] text-muted">
        {parts.map((p) => (
          <span
            key={p.key}
            className={`relative pl-3 pr-0.5 before:absolute before:left-[0.3rem] before:text-muted/60 before:content-['·'] ${p.wide ? "hidden sm:inline" : ""}`}
          >
            {p.node}
          </span>
        ))}
      </p>
    </div>
  );
}

function Labels({ article }: { article: Article }) {
  if (!article.is_breaking && !article.category) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {article.is_breaking && <span className="category-badge bg-accent">Breaking</span>}
      {article.category && <span className="category-badge">{article.category.name}</span>}
    </div>
  );
}

const headline = "text-ink transition-colors group-hover:text-brand";

export function ArticleCard({ article, variant = "grid", priority }: { article: Article; variant?: Variant; priority?: boolean }) {
  const href = `/balita/${article.slug}`;

  if (variant === "compact") {
    return (
      <article className="group">
        <Link href={href} className="flex gap-3.5">
          <Thumb article={article} sizes="112px" className="aspect-[4/3] w-28 shrink-0 rounded" />
          <div className="min-w-0 space-y-1">
            {article.category && <p className="category-badge">{article.category.name}</p>}
            <h3 className={`line-clamp-3 text-[0.92rem] font-medium leading-snug ${headline}`}>{article.title}</h3>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "side") {
    return (
      <article className="group">
        <Link href={href} className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h3 className={`line-clamp-3 text-[1.02rem] font-medium leading-snug ${headline}`}>{article.title}</h3>
            <Meta article={article} showAuthor={false} showCategory />
          </div>
          <Thumb article={article} sizes="140px" className="aspect-[16/10] w-32 shrink-0 rounded sm:w-36" />
        </Link>
      </article>
    );
  }

  if (variant === "list") {
    return (
      <article className="group">
        <Link href={href} className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center sm:gap-6">
          <Thumb article={article} sizes="(min-width: 640px) 240px, 112px" className="aspect-[4/3] w-full rounded sm:aspect-[16/10]" />
          <div className="min-w-0 space-y-1.5 sm:space-y-2">
            <h3 className={`line-clamp-3 text-[0.98rem] font-medium leading-snug sm:text-[1.15rem] md:text-[1.3rem] ${headline}`}>{article.title}</h3>
            {article.excerpt && <p className="hidden text-[0.92rem] text-ink-soft sm:line-clamp-2">{article.excerpt}</p>}
            <Meta article={article} showAuthor={false} showCategory />
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "feature") {
    return (
      <article className="group">
        <Link href={href} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-8">
          <div className="order-2 flex flex-col gap-4 md:order-1">
            <Labels article={article} />
            <h2 className={`text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.015em] md:text-[2rem] xl:text-[2.25rem] ${headline}`}>
              {article.title}
            </h2>
            {article.excerpt && <p className="text-[1rem] leading-relaxed text-ink-soft">{article.excerpt}</p>}
            <div className="mt-auto pt-2">
              <Meta article={article} />
            </div>
          </div>
          <Thumb
            article={article}
            priority={priority}
            sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
            className="order-1 aspect-[4/3] w-full rounded md:order-2"
          />
        </Link>
      </article>
    );
  }

  return (
    <article className="group flex flex-col">
      {/* Phones: thumbnail row (keeps long pages scannable); sm and up: image over headline. */}
      <Link href={href} className="grid h-full grid-cols-[112px_minmax(0,1fr)] items-start gap-3.5 sm:flex sm:flex-col sm:gap-3">
        <Thumb
          article={article}
          priority={priority}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 112px"
          className="aspect-[4/3] w-full rounded sm:aspect-[16/10]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-3">
          <Labels article={article} />
          <h3 className={`line-clamp-3 text-[0.95rem] font-medium leading-snug sm:line-clamp-none sm:text-[1.08rem] ${headline}`}>{article.title}</h3>
          <div className="mt-auto hidden sm:block">
            <Meta article={article} showAuthor={false} showReading={false} />
          </div>
        </div>
      </Link>
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-xl font-semibold text-ink">{title}</p>
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
    <div className={`mb-8 ${light ? "border-y border-white/25 py-3.5" : "section-rule"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <Tag className={`text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] md:text-[1.9rem] ${light ? "text-white" : "text-ink"}`}>
          {title}
        </Tag>
        {action && (
          <Link href={action.href} className={`text-sm font-semibold ${light ? "text-white" : "text-ink"} hover:text-brand`}>
            {action.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {description && <p className={`mt-1.5 max-w-2xl text-[0.95rem] ${light ? "text-white/80" : "text-ink-soft"}`}>{description}</p>}
    </div>
  );
}
