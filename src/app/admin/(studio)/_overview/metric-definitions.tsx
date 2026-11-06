/** "Paano binibilang" — how every number on the dashboard and analytics screens is computed. */
export function MetricDefinitions({ showAnalytics }: { showAnalytics: boolean }) {
  return (
    <section aria-labelledby="metric-defs" className="rounded-xl border border-line bg-white p-5 text-sm text-ink-soft">
      <h2 id="metric-defs" className="mb-3 text-[0.95rem] font-bold text-ink">
        Paano binibilang
      </h2>
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <Def term="Mga araw at saklaw">Lahat ng petsa ay araw sa Maynila (UTC+8). Ang saklaw ay mula 12:00 AM ng unang araw hanggang bago mag-12:00 AM pagkatapos ng huling araw.</Def>
        <Def term="Bilang ng artikulo">Kasalukuyang status ng mga artikulong pinapayagan kang makita. Kung wala kang “view all” na pahintulot, sarili mong mga artikulo lamang ang bilang.</Def>
        <Def term="Nailathala">Batay sa unang petsa ng paglalathala (first_published_at); hindi muling binibilang ang mga update.</Def>
        <Def term="Aktibong manunulat">Bilang ng iba’t ibang may-akda na may artikulong huling binago sa loob ng saklaw.</Def>
        {showAnalytics && (
          <>
            <Def term="Page views">
              Galing sa sariling first-party na tala ng site (walang third-party tracker). Hindi binibilang ang may Do Not Track o Global Privacy Control, ang mga kilalang bot, at ang parehong bisita sa parehong pahina sa loob ng 30 minuto. Aggregated ito tuwing bubuksan ang pahina — hindi real-time na stream.
            </Def>
            <Def term="Bisita (tinatayang)">
              Gumagamit ng hash na nagpapalit araw-araw at hindi nag-iimbak ng IP. Kaya ang isang tao ay binibilang nang isang beses bawat araw; sa mas mahabang saklaw, ang kabuuan ay suma ng mga araw-araw na bisita, hindi tunay na “unique” na tao.
            </Def>
          </>
        )}
        <Def term="Mga balota">Bawat tinanggap na boto sa botohan (isang balota kahit maraming pinili). Ang mga online na botohan ay boluntaryo at hindi kumakatawan sa buong populasyon ng Pilipinas.</Def>
        <Def term="Newsletter">Mga email na kasalukuyang naka-subscribe at nagbigay ng pahintulot; hindi kasama ang nag-unsubscribe o na-suppress.</Def>
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
