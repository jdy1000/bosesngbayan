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
        description="Edit the homepage draft here. Nothing changes on the public site until you press Publish."
        actions={
          draftId ? (
            <Link href="/admin/preview/homepage" target="_blank" className="btn btn-outline min-h-10 px-4 text-sm">
              Preview draft ↗
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Summary label="Draft" value={`${sections.length} ${sections.length === 1 ? "section" : "sections"}`} note={`${enabledCount} enabled`} />
        <Summary
          label="Published"
          value={published ? `${published.sectionCount} ${published.sectionCount === 1 ? "section" : "sections"}` : "None yet"}
          note={published ? `${formatDateTime(published.publishedAt)}${published.publisher ? ` · by ${published.publisher}` : ""}` : "Not published yet"}
        />
        <Summary label="Versions" value={`${history.length}`} note="Latest 15 published/archived" />
      </div>

      {!draftId ? (
        <Empty title="No working draft">
          <ActionForm action={createDraft} className="mt-3">
            <SubmitButton pendingLabel="Creating…">{published ? "Copy the published version as a draft" : "Create a blank draft"}</SubmitButton>
          </ActionForm>
        </Empty>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            {brokenEnabled > 0 && <Notice tone="error">{brokenEnabled} enabled {brokenEnabled === 1 ? "section has" : "sections have"} invalid settings. Fix or disable {brokenEnabled === 1 ? "it" : "them"} before publishing.</Notice>}
            {sections.length === 0 ? (
              <Empty title="The draft has no sections">Add a block with the form on the side.</Empty>
            ) : (
              <ol className="space-y-3">
                {sections.map((s, i) => (
                  <SectionEditor key={s.id} section={s} options={options} index={i} total={sections.length} />
                ))}
              </ol>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title="Publish" description="Copies the draft as a new published version and archives the previous one.">
              <ActionForm action={publishHomepage} className="space-y-3" confirm="Publish the draft to the public homepage?">
                <div>
                  <label htmlFor="pub-label" className="mb-1.5 block text-sm font-semibold text-ink">
                    Version label
                  </label>
                  <input id="pub-label" name="label" maxLength={200} placeholder="e.g. Election update" className="field" />
                </div>
                <SubmitButton pendingLabel="Publishing…">Publish homepage</SubmitButton>
              </ActionForm>
            </Panel>
            <Panel title="Add a block">
              <ActionForm action={addSection} className="space-y-3">
                <label htmlFor="add-type" className="sr-only">
                  Block type
                </label>
                <select id="add-type" name="block_type" required className="field" defaultValue="">
                  <option value="" disabled>
                    Choose a type…
                  </option>
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BLOCK_LABELS[t]}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="outline" pendingLabel="Adding…">
                  Add to the end
                </SubmitButton>
              </ActionForm>
            </Panel>
          </aside>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-ink">Version history</h2>
        {history.length === 0 ? (
          <Empty title="No published versions yet" />
        ) : (
          <Table head={["Version", "Status", "Published", "Sections", ""]}>
            {history.map((h) => (
              <tr key={h.id}>
                <td className="font-semibold text-ink">{h.label ?? "No label"}</td>
                <td>{h.status === "published" ? <Badge tone="green">Published</Badge> : <Badge>Archived</Badge>}</td>
                <td className="whitespace-nowrap">
                  {formatDateTime(h.publishedAt ?? h.createdAt)}
                  {h.publisher && <span className="block text-xs text-muted">by {h.publisher}</span>}
                </td>
                <td className="tabular-nums">{h.sectionCount}</td>
                <td className="text-right">
                  <ActionForm action={restoreConfiguration} confirm="This version will replace the current draft. Continue?">
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton variant="ghost" pendingLabel="Restoring…" className="min-h-9 px-3">
                      Restore to draft
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
    <div className="rounded-2xl bg-paper shadow-card ring-1 ring-line px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{note}</p>
    </div>
  );
}
