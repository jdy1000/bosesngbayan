import Link from "next/link";
import { PollWidget } from "@/components/public/poll-widget";
import { ShareButtons } from "@/components/public/share-buttons";
import { getPublicPollBySlug, isPollOpen } from "@/lib/cms/polls";
import { redirectOrNotFound } from "@/lib/cms/redirects";
import { siteUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const poll = await getPublicPollBySlug(slug);
  if (!poll) return {};
  return buildMetadata({ title: poll.question, description: poll.description, path: `/botohan/${poll.slug}` });
}

export default async function PollPage({ params }: Props) {
  const { slug } = await params;
  const poll = await getPublicPollBySlug(slug);
  if (!poll) return redirectOrNotFound(`/botohan/${slug}`);
  const open = isPollOpen(poll);
  const { locale, t } = await getI18n();
  const m = t.poll;

  return (
    <div className="container-site max-w-3xl py-10 md:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
        <Link href="/botohan" className="hover:text-brand">
          {m.backToAll}
        </Link>
      </nav>
      {poll.category && (
        <Link href={`/paksa/${poll.category.slug}`} className="category-badge">
          {poll.category.name}
        </Link>
      )}
      <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink">{poll.question}</h1>
      {poll.description && <p className="mt-3 text-lg text-ink-soft">{poll.description}</p>}
      <div className="mt-6">
        <PollWidget poll={poll} />
      </div>
      <dl className="mt-6 grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
        {poll.opens_at && (
          <div>
            <dt className="font-semibold text-ink">{m.openedAt}</dt>
            <dd>{formatDateTime(poll.opens_at, locale)}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-ink">{open ? m.closesAt : m.closedAt}</dt>
          <dd>{poll.closes_at || poll.closed_at ? formatDateTime(poll.closed_at ?? poll.closes_at, locale) : m.noDate}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <ShareButtons url={siteUrl(`/botohan/${poll.slug}`)} title={poll.question} />
      </div>
      <aside className="mt-10 rounded-md bg-surface p-6">
        <h2 className="text-xl font-semibold text-ink">{m.methodology}</h2>
        {poll.methodology_note && <p className="mt-2 whitespace-pre-line text-[0.95rem] text-ink-soft">{poll.methodology_note}</p>}
        <p className="mt-2 text-[0.95rem] text-ink-soft">
          {m.caveat}{" "}
          <Link href="/botohan#metodolohiya" className="font-semibold text-brand hover:underline">
            {m.methodHeading}
          </Link>
        </p>
      </aside>
    </div>
  );
}
