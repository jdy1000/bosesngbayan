import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, formatNumber, percent } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Notice, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { pollLifecycle, updatePoll } from "../actions";
import { POLL_STATUS } from "../labels";
import { PollFields } from "../poll-fields";
import { OptionsPanel } from "./options-panel";
import { PollHistory } from "./poll-history";

export const metadata = { title: "Poll" };

interface StaffResults {
  visible: boolean;
  total_ballots?: number;
  options?: { option_id: string; votes: number }[];
}

export default async function PollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const canManage = ctx.permissions.has("polls.manage");
  const canResults = ctx.permissions.has("polls.view_results");
  if (!canManage && !canResults) redirect("/admin?denied=1");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ data: poll }, { data: categories }, { data: hasVotes }] = await Promise.all([
    ctx.supabase
      .from("polls")
      .select(
        "id, slug, question, description, kind, max_choices, status, is_featured, opens_at, closes_at, results_visibility, voting_policy, methodology_note, category_id, published_at, closed_at, created_at, options:poll_options(id, label, position, created_at)",
      )
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase.from("categories").select("id, name").order("sort_order").order("name"),
    ctx.supabase.rpc("poll_has_votes", { p_poll_id: id }),
  ]);
  if (!poll) notFound();
  const options = [...poll.options].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  const locked = hasVotes === true;

  let results: StaffResults | null = null;
  if (canResults) {
    const { data } = await ctx.supabase.rpc("get_poll_results", { p_poll_id: id, p_voter_hash: null });
    results = (data as StaffResults | null) ?? null;
  }
  const total = results?.total_ballots ?? 0;
  const votesByOption = new Map((results?.options ?? []).map((o) => [o.option_id, o.votes]));

  const lifecycle: { op: string; label: string; show: boolean; variant?: "primary" | "outline" | "danger"; confirm?: string }[] = [
    { op: "publish", label: "I-publish", show: poll.status === "draft", variant: "primary" },
    { op: "unpublish", label: "Ibalik sa draft", show: poll.status === "published" && !locked, variant: "outline" },
    { op: "close", label: "Isara ang botohan", show: poll.status === "published", variant: "outline", confirm: "Isara ang botohan? Hindi na makakaboto ang publiko." },
    { op: "feature", label: "Gawing featured", show: !poll.is_featured && (poll.status === "published" || poll.status === "closed"), variant: "outline" },
    { op: "unfeature", label: "Alisin sa featured", show: poll.is_featured, variant: "outline" },
    { op: "archive", label: "I-archive", show: poll.status !== "archived", variant: "outline", confirm: "I-archive ang poll? Mawawala ito sa pampublikong site." },
    { op: "delete", label: "Burahin", show: poll.status === "draft" && !locked, variant: "danger", confirm: "Permanenteng burahin ang draft na poll na ito?" },
  ];

  return (
    <>
      <PageHeader
        title={poll.question}
        breadcrumb={[{ label: "Mga Botohan", href: "/admin/polls" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={poll.status} map={POLL_STATUS} />
            {poll.is_featured && <Badge tone="navy">Featured</Badge>}
            {locked && <Badge tone="amber">May mga boto — naka-lock</Badge>}
            {(poll.status === "published" || poll.status === "closed") && (
              <Link href={`/botohan/${poll.slug}`} target="_blank" className="text-sm font-semibold text-brand hover:underline">
                Tingnan sa site ↗
              </Link>
            )}
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {canManage ? (
            <Panel title="Detalye ng poll">
              <ActionForm action={updatePoll} className="space-y-6">
                <input type="hidden" name="id" value={poll.id} />
                <PollFields values={poll} categories={categories ?? []} locked={locked} />
                <SubmitButton>I-save ang mga pagbabago</SubmitButton>
              </ActionForm>
            </Panel>
          ) : (
            <Notice>Read-only ang view na ito: maaari mong tingnan at i-export ang resulta, pero hindi baguhin ang poll.</Notice>
          )}
          <OptionsPanel pollId={poll.id} options={options} locked={locked} canManage={canManage} />
          {ctx.permissions.has("audit.view") && <PollHistory ctx={ctx} pollId={poll.id} />}
        </div>

        <aside className="space-y-6">
          {canManage && (
            <Panel title="Lifecycle">
              <dl className="mb-4 space-y-1 text-sm text-ink-soft">
                <div>Ginawa: {formatDateTime(poll.created_at)}</div>
                {poll.published_at && <div>Na-publish: {formatDateTime(poll.published_at)}</div>}
                {poll.closed_at && <div>Isinara: {formatDateTime(poll.closed_at)}</div>}
              </dl>
              <div className="flex flex-wrap gap-2">
                {lifecycle
                  .filter((l) => l.show)
                  .map((l) => (
                    <ActionForm key={l.op} action={pollLifecycle} confirm={l.confirm}>
                      <input type="hidden" name="id" value={poll.id} />
                      <SubmitButton name="op" value={l.op} variant={l.variant} pendingLabel="Sandali…">
                        {l.label}
                      </SubmitButton>
                    </ActionForm>
                  ))}
              </div>
              {poll.status === "published" && locked && (
                <p className="mt-3 text-xs text-muted">May mga boto na kaya hindi na ito maibabalik sa draft. Isara o i-archive na lamang.</p>
              )}
            </Panel>
          )}

          <Panel
            title="Resulta"
            actions={
              canResults && (
                <a href={`/admin/polls/${poll.id}/export`} className="text-sm font-semibold text-brand hover:underline">
                  I-export CSV
                </a>
              )
            }
          >
            {!canResults ? (
              <p className="text-sm text-muted">Kailangan ng pahintulot na “polls.view_results” para makita ang resulta.</p>
            ) : !results?.visible ? (
              <p className="text-sm text-accent-700">Hindi makuha ang resulta.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-soft">
                  Kabuuang balota: <strong className="tabular-nums text-ink">{formatNumber(total)}</strong>
                  {poll.kind === "multiple" && " (maaaring higit sa isang sagot bawat balota)"}
                </p>
                <ul className="space-y-3">
                  {options.map((o) => {
                    const votes = votesByOption.get(o.id) ?? 0;
                    const pct = percent(votes, total);
                    return (
                      <li key={o.id}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="text-ink">{o.label}</span>
                          <span className="shrink-0 tabular-nums text-ink-soft">
                            {formatNumber(votes)} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden="true">
                          <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-xs text-muted">
                  Ang porsiyento ay bahagi ng kabuuang balota. Boluntaryong online poll ito at hindi kumakatawan sa buong populasyon ng Pilipinas.
                </p>
              </>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
