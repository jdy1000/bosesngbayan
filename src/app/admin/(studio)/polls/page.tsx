import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { Badge, Empty, Notice, PageHeader, Pagination, StatusBadge, Table, withParams } from "@/components/studio/ui";
import { POLL_STATUS } from "./labels";

export const metadata = { title: "Polls" };

const PAGE_SIZE = 25;
const STATUSES = ["draft", "published", "closed", "archived"] as const;

export default async function PollsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage();
  if (!ctx.permissions.has("polls.manage") && !ctx.permissions.has("polls.view_results")) redirect("/admin?denied=1");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  let query = ctx.supabase
    .from("polls")
    .select("id, slug, question, status, is_featured, opens_at, closes_at, updated_at, category:categories(name)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`question.ilike.${like},slug.ilike.${like}`);
  }
  const { data: polls, count, error } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const canManage = ctx.permissions.has("polls.manage");

  return (
    <>
      <PageHeader
        title="Polls"
        description="Create, publish, close and export polls. Results come from actual votes."
        actions={
          canManage && (
            <Link href="/admin/polls/new" className="btn btn-primary min-h-10 px-4 text-sm">
              New poll
            </Link>
          )
        }
      />
      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Search question or slug…" className="field" />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="field">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {POLL_STATUS[s].label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
          Filter
        </button>
      </form>

      {error ? (
        <Notice tone="error">Could not load polls. Try refreshing the page.</Notice>
      ) : !polls || polls.length === 0 ? (
        <Empty title={q || status ? "No matching polls" : "No polls yet"}>
          {canManage && !q && !status ? "Create the first poll with “New poll”." : "Try changing the filter."}
        </Empty>
      ) : (
        <>
          <Table head={["Question", "Status", "Category", "Opens / Closes", "Last modified"]}>
            {polls.map((p) => (
              <tr key={p.id}>
                <td className="max-w-md">
                  <Link href={`/admin/polls/${p.id}`} className="font-semibold text-ink hover:text-brand">
                    {p.question}
                  </Link>
                  <p className="text-xs text-muted">/botohan/{p.slug}</p>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={p.status} map={POLL_STATUS} />
                    {p.is_featured && <Badge tone="navy">Featured</Badge>}
                  </div>
                </td>
                <td className="text-ink-soft">{p.category?.name ?? "—"}</td>
                <td className="text-xs text-ink-soft">
                  <div>{p.opens_at ? formatDateTime(p.opens_at) : "On publish"}</div>
                  <div>{p.closes_at ? formatDateTime(p.closes_at) : "No scheduled close"}</div>
                </td>
                <td className="text-xs text-ink-soft">{formatDateTime(p.updated_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={totalPages} hrefFor={(n) => withParams("/admin/polls", { q, status, page: n })} />
        </>
      )}
    </>
  );
}
