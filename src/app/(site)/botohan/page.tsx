import Link from "next/link";
import { EmptyState } from "@/components/public/article-card";
import { PollWidget } from "@/components/public/poll-widget";
import { listPublicPolls } from "@/lib/cms/polls";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n, getMessages } from "@/lib/i18n/server";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const m = (await getMessages()).poll;
  return buildMetadata({ title: m.listTitle, description: m.listDescription, path: "/botohan" });
}

export default async function PollsPage() {
  const [active, past, { locale, t }] = await Promise.all([listPublicPolls("active", 24), listPublicPolls("past", 24), getI18n()]);
  const m = t.poll;
  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-10 max-w-3xl">
        <h1 className="text-4xl font-semibold text-ink md:text-5xl">{m.listTitle}</h1>
        <p className="mt-3 text-lg text-ink-soft">{m.listIntro}</p>
      </header>

      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="mb-5 text-2xl font-semibold text-ink">{m.activeHeading}</h2>
        {active.length ? (
          // Columns follow the count so a short row fills the width instead of leaving an empty third column.
          <div className={`grid gap-6 ${active.length === 1 ? "max-w-xl" : active.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
            {active.map((p) => (
              <PollWidget key={p.id} poll={p} />
            ))}
          </div>
        ) : (
          <EmptyState title={m.noActive} />
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="mt-14">
          <h2 id="past-heading" className="mb-5 text-2xl font-semibold text-ink">{m.pastHeading}</h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-paper">
            {past.map((p) => (
              <li key={p.id}>
                <Link href={`/botohan/${p.slug}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold text-ink">{p.question}</span>
                  <span className="text-sm text-muted">{fmt(m.closedOn, { date: formatDate(p.closed_at ?? p.closes_at, locale) })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="metodolohiya" aria-labelledby="method-heading" className="mt-14 rounded-md bg-surface p-6 md:p-8">
        <h2 id="method-heading" className="text-2xl font-semibold text-ink">{m.methodHeading}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[0.95rem] text-ink-soft">
          <li>
            {m.methodVoluntaryBefore}
            <strong>{m.methodVoluntaryStrong}</strong>
            {m.methodVoluntaryAfter}
          </li>
          <li>{m.methodOnePerBrowser}</li>
          <li>{m.methodPrivacy}</li>
          <li>{m.methodVisibility}</li>
        </ul>
      </section>
    </div>
  );
}
