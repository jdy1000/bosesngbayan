import { TipForm } from "@/components/public/tip-form";
import { buildMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return buildMetadata({ title: t.tips.title, description: t.tips.metaDescription, path: "/mag-ulat" });
}

/** Public tip line (ADR-024). Tips are stored privately for the editors and never published. */
export default async function TipLinePage() {
  const { t } = await getI18n();
  const c = t.tips;
  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-8 max-w-3xl">
        {/* The client's call to action, in its own words (ADR-023). */}
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Speak Up. Seek the Truth. Expose Corruption. Demand Accountability.</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink md:text-5xl">{c.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{c.intro}</p>
      </header>

      {/* Safety notes come first in reading order, so a phone user sees them before the form; on desktop they sit beside it. */}
      <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <aside
          aria-labelledby="tip-safety-heading"
          className="h-fit rounded-md border border-line p-6 lg:sticky lg:top-32 lg:col-start-2 lg:row-start-1"
        >
          <h2 id="tip-safety-heading" className="text-2xl font-semibold text-ink">{c.safetyHeading}</h2>
          <ul className="mt-4 space-y-3 text-[0.95rem] text-ink-soft">
            {c.safety.map((line) => (
              <li key={line} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section aria-labelledby="tip-form-heading" className="lg:col-start-1 lg:row-start-1">
          <h2 id="tip-form-heading" className="mb-4 text-2xl font-semibold text-ink">{c.formHeading}</h2>
          <TipForm />
        </section>
      </div>
    </div>
  );
}
