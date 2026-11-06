import Link from "next/link";
import { EmptyState } from "@/components/public/article-card";
import { PollWidget } from "@/components/public/poll-widget";
import { listPublicPolls } from "@/lib/cms/polls";
import { formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata() {
  return buildMetadata({ title: "Mga Botohan", description: "Makilahok sa mga online na botohan ng Boses ng Bayan.", path: "/botohan" });
}

export default async function PollsPage() {
  const [active, past] = await Promise.all([listPublicPolls("active", 24), listPublicPolls("past", 24)]);
  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-10 max-w-3xl">
        <h1 className="text-4xl font-semibold text-ink md:text-5xl">Mga Botohan</h1>
        <p className="mt-3 text-lg text-ink-soft">Iparinig ang iyong boses sa mga isyung mahalaga sa bayan.</p>
      </header>

      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="mb-5 text-2xl font-semibold text-ink">Bukas na botohan</h2>
        {active.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <PollWidget key={p.id} poll={p} />
            ))}
          </div>
        ) : (
          <EmptyState title="Walang bukas na botohan ngayon." />
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="mt-14">
          <h2 id="past-heading" className="mb-5 text-2xl font-semibold text-ink">Mga nakaraang botohan</h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-white">
            {past.map((p) => (
              <li key={p.id}>
                <Link href={`/botohan/${p.slug}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold text-ink">{p.question}</span>
                  <span className="text-sm text-muted">Nagsara {formatDate(p.closed_at ?? p.closes_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="metodolohiya" aria-labelledby="method-heading" className="mt-14 rounded-md bg-surface p-6 md:p-8">
        <h2 id="method-heading" className="text-2xl font-semibold text-ink">Paano binibilang ang boto</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[0.95rem] text-ink-soft">
          <li>
            Ang mga botohan dito ay <strong>boluntaryong online poll</strong>. Ang lumalahok ay ang mga piniling bumoto, kaya hindi ito
            kumakatawan sa buong populasyon ng Pilipinas at hindi ito siyentipikong survey.
          </li>
          <li>Isang boto bawat browser ang pinapayagan; may ilang botohan na naglilimita rin bawat network. Sinusuri ang bawat boto sa server.</li>
          <li>Hindi kami nag-iimbak ng iyong IP address o pangalan para sa pagboto—tanging hindi mababasang hash ang ginagamit para pigilan ang dobleng boto.</li>
          <li>Ang resulta ay ipinapakita ayon sa setting ng bawat poll: palagi, pagkatapos bumoto, o pagkatapos magsara.</li>
        </ul>
      </section>
    </div>
  );
}
