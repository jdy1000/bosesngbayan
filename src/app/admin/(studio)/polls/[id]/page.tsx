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
    { op: "publish", label: "Publish", show: poll.status === "draft", variant: "primary" },
    { op: "unpublish", label: "Return to draft", show: poll.status === "published" && !locked, variant: "outline" },
    { op: "close", label: "Close poll", show: poll.status === "published", variant: "outline", confirm: "Close this poll? The public will no longer be able to vote." },
    { op: "feature", label: "Make featured", show: !poll.is_featured && (poll.status === "published" || poll.status === "closed"), variant: "outline" },
    { op: "unfeature", label: "Remove from featured", show: poll.is_featured, variant: "outline" },
    { op: "archive", label: "Archive", show: poll.status !== "archived", variant: "outline", confirm: "Archive this poll? It will be removed from the public site." },
    { op: "delete", label: "Delete", show: poll.status === "draft" && !locked, variant: "danger", confirm: "Permanently delete this draft poll?" },
  ];

  return (
    <>
      <PageHeader
        title={poll.question}
        breadcrumb={[{ label: "Polls", href: "/admin/polls" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={poll.status} map={POLL_STATUS} />
            {poll.is_featured && <Badge tone="navy">Featured</Badge>}
            {locked && <Badge tone="amber">Has votes — locked</Badge>}
            {(poll.status === "published" || poll.status === "closed") && (
              <Link href={`/botohan/${poll.slug}`} target="_blank" className="text-sm font-semibold text-brand hover:underline">
                View on site ↗
              </Link>
            )}
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {canManage ? (
            <Panel title="Poll details">
              <ActionForm action={updatePoll} className="space-y-6">
                <input type="hidden" name="id" value={poll.id} />
                <PollFields values={poll} categories={categories ?? []} locked={locked} />
                <SubmitButton>Save changes</SubmitButton>
              </ActionForm>
            </Panel>
          ) : (
            <Notice>This view is read-only: you can view and export the results, but not change the poll.</Notice>
          )}
          <OptionsPanel pollId={poll.id} options={options} locked={locked} canManage={canManage} />
          {ctx.permissions.has("audit.view") && <PollHistory ctx={ctx} pollId={poll.id} />}
        </div>

        <aside className="space-y-6">
          {canManage && (
            <Panel title="Lifecycle">
              <dl className="mb-4 space-y-1 text-sm text-ink-soft">
                <div>Created: {formatDateTime(poll.created_at)}</div>
                {poll.published_at && <div>Published: {formatDateTime(poll.published_at)}</div>}
                {poll.closed_at && <div>Closed: {formatDateTime(poll.closed_at)}</div>}
              </dl>
              <div className="flex flex-wrap gap-2">
                {lifecycle
                  .filter((l) => l.show)
                  .map((l) => (
                    <ActionForm key={l.op} action={pollLifecycle} confirm={l.confirm}>
                      <input type="hidden" name="id" value={poll.id} />
                      <SubmitButton name="op" value={l.op} variant={l.variant} pendingLabel="Working…">
                        {l.label}
                      </SubmitButton>
                    </ActionForm>
                  ))}
              </div>
              {poll.status === "published" && locked && (
                <p className="mt-3 text-xs text-muted">This poll has votes, so it can no longer return to draft. Close or archive it instead.</p>
              )}
            </Panel>
          )}

          <Panel
            title="Results"
            actions={
              canResults && (
                <a href={`/admin/polls/${poll.id}/export`} className="text-sm font-semibold text-brand hover:underline">
                  Export CSV
                </a>
              )
            }
          >
            {!canResults ? (
              <p className="text-sm text-muted">You need the “polls.view_results” permission to see the results.</p>
            ) : !results?.visible ? (
              <p className="text-sm text-accent-700">Could not load the results.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-soft">
                  Total ballots: <strong className="tabular-nums text-ink">{formatNumber(total)}</strong>
                  {poll.kind === "multiple" && " (a ballot may include more than one choice)"}
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
                  Percentages are shares of total ballots. This is a voluntary online poll and does not represent the whole Philippine population.
                </p>
              </>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
