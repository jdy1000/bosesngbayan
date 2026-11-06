/** "How we count" — how every number on the dashboard and analytics screens is computed. */
export function MetricDefinitions({ showAnalytics }: { showAnalytics: boolean }) {
  return (
    <section aria-labelledby="metric-defs" className="rounded-2xl bg-paper shadow-card ring-1 ring-line p-5 text-sm text-ink-soft">
      <h2 id="metric-defs" className="mb-3 text-[0.95rem] font-bold text-ink">
        How we count
      </h2>
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <Def term="Days and ranges">All dates are Manila calendar days (UTC+8). A range runs from 12:00 AM on the first day until just before 12:00 AM after the last day.</Def>
        <Def term="Article counts">Current status of the articles you are allowed to see. Without the “view all” permission, only your own articles are counted.</Def>
        <Def term="Published">Based on the first publication date (first_published_at); updates are not counted again.</Def>
        <Def term="Active writers">Number of distinct authors with an article last modified within the range.</Def>
        {showAnalytics && (
          <>
            <Def term="Page views">
              From the site’s own first-party records (no third-party trackers). Visitors with Do Not Track or Global Privacy Control, known bots, and the same visitor on the same page within 30 minutes are not counted. Aggregated each time this page opens — not a real-time stream.
            </Def>
            <Def term="Visitors (estimated)">
              Uses a hash that rotates daily and never stores IP addresses. A person is counted once per day; over longer ranges the total is the sum of daily visitors, not truly “unique” people.
            </Def>
          </>
        )}
        <Def term="Ballots">Each accepted vote in a poll (one ballot even with several choices). Online polls are voluntary and do not represent the whole Philippine population.</Def>
        <Def term="Newsletter">Emails currently subscribed with consent given; unsubscribed and suppressed addresses are excluded.</Def>
      </dl>
    </section>
  );
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
