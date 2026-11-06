import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Notice, PageHeader, Panel, Table } from "@/components/studio/ui";
import { BLOCK_LABELS, BLOCK_TYPES } from "@/lib/homepage/blocks";
import { formatDateTime } from "@/lib/format";
import { loadBuilder } from "@/lib/studio/homepage";
import { addSection, createDraft, publishHomepage, restoreConfiguration } from "./actions";
import { SectionEditor } from "./section-editor";

export const metadata: Metadata = { title: "Homepage Builder" };

export default async function HomepageBuilderPage() {
  const ctx = await requireStaffPage("homepage.manage");
  const { draftId, sections, history, options } = await loadBuilder(ctx);
  const published = history.find((h) => h.status === "published") ?? null;
  const enabledCount = sections.filter((s) => s.isEnabled).length;
  const brokenEnabled = sections.filter((s) => s.isEnabled && s.issues.length > 0).length;

  return (
    <>
      <PageHeader
        title="Homepage Builder"
        description="Inaayos dito ang draft ng homepage. Walang makikita ang publiko hangga't hindi pinipindot ang I-publish."
        actions={
          draftId ? (
            <Link href="/admin/preview/homepage" target="_blank" className="btn btn-outline min-h-10 px-4 text-sm">
              Preview ng draft ↗
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Summary label="Draft" value={`${sections.length} section`} note={`${enabledCount} naka-enable`} />
        <Summary
          label="Naka-publish"
          value={published ? `${published.sectionCount} section` : "Wala pa"}
          note={published ? `${formatDateTime(published.publishedAt)}${published.publisher ? ` · ni ${published.publisher}` : ""}` : "Hindi pa na-publish"}
        />
        <Summary label="Mga bersyon" value={`${history.length}`} note="Pinakahuling 15 na published/archived" />
      </div>

      {!draftId ? (
        <Empty title="Walang working draft">
          <ActionForm action={createDraft} className="mt-3">
            <SubmitButton pendingLabel="Ginagawa…">{published ? "Kopyahin ang naka-publish bilang draft" : "Gumawa ng blangkong draft"}</SubmitButton>
          </ActionForm>
        </Empty>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            {brokenEnabled > 0 && <Notice tone="error">{brokenEnabled} naka-enable na section ang may hindi wastong settings. Ayusin o i-disable bago mag-publish.</Notice>}
            {sections.length === 0 ? (
              <Empty title="Walang section ang draft">Magdagdag ng block gamit ang form sa gilid.</Empty>
            ) : (
              <ol className="space-y-3">
                {sections.map((s, i) => (
                  <SectionEditor key={s.id} section={s} options={options} index={i} total={sections.length} />
                ))}
              </ol>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title="I-publish" description="Kinokopya ang draft bilang bagong naka-publish na bersyon; ina-archive ang dati.">
              <ActionForm action={publishHomepage} className="space-y-3" confirm="I-publish ang draft sa pampublikong homepage?">
                <div>
                  <label htmlFor="pub-label" className="mb-1.5 block text-sm font-semibold text-ink">
                    Label ng bersyon
                  </label>
                  <input id="pub-label" name="label" maxLength={200} placeholder="hal. Update para sa halalan" className="field" />
                </div>
                <SubmitButton pendingLabel="Pina-publish…">I-publish ang homepage</SubmitButton>
              </ActionForm>
            </Panel>
            <Panel title="Magdagdag ng block">
              <ActionForm action={addSection} className="space-y-3">
                <label htmlFor="add-type" className="sr-only">
                  Uri ng block
                </label>
                <select id="add-type" name="block_type" required className="field" defaultValue="">
                  <option value="" disabled>
                    Pumili ng uri…
                  </option>
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BLOCK_LABELS[t]}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="outline" pendingLabel="Idinadagdag…">
                  Idagdag sa dulo
                </SubmitButton>
              </ActionForm>
            </Panel>
          </aside>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-ink">Kasaysayan ng bersyon</h2>
        {history.length === 0 ? (
          <Empty title="Wala pang na-publish na bersyon" />
        ) : (
          <Table head={["Bersyon", "Status", "Na-publish", "Sections", ""]}>
            {history.map((h) => (
              <tr key={h.id}>
                <td className="font-semibold text-ink">{h.label ?? "Walang label"}</td>
                <td>{h.status === "published" ? <Badge tone="green">Naka-publish</Badge> : <Badge>Archived</Badge>}</td>
                <td className="whitespace-nowrap">
                  {formatDateTime(h.publishedAt ?? h.createdAt)}
                  {h.publisher && <span className="block text-xs text-muted">ni {h.publisher}</span>}
                </td>
                <td className="tabular-nums">{h.sectionCount}</td>
                <td className="text-right">
                  <ActionForm action={restoreConfiguration} confirm="Papalitan ng bersyong ito ang kasalukuyang draft. Ituloy?">
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton variant="ghost" pendingLabel="Ibinabalik…" className="min-h-9 px-3">
                      Ibalik sa draft
                    </SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-white shadow-card ring-1 ring-line px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{note}</p>
    </div>
  );
}
