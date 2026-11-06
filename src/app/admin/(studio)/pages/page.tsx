import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { Empty, PageHeader, StatusBadge, Table, withParams } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { listStudioPages } from "@/lib/studio/pages";
import { PAGE_STATUSES, PAGE_STATUS_LABELS, type PageStatus } from "./status";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireStaffPage("pages.manage");
  const raw = (await searchParams).status;
  const status = PAGE_STATUSES.includes(raw as PageStatus) ? (raw as PageStatus) : undefined;
  const pages = await listStudioPages(ctx, status);

  return (
    <>
      <PageHeader
        title="Pages"
        description="Static pages such as About (Tungkol), Editorial Policy and Privacy Policy."
        actions={
          <Link href="/admin/pages/new" className="btn btn-primary min-h-10 px-4 text-sm">
            + New page
          </Link>
        }
      />
      <nav aria-label="Filter by status" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {[undefined, ...PAGE_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={withParams("/admin/pages", { status: s })}
            aria-current={s === status ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${s === status ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {s ? PAGE_STATUS_LABELS[s].label : "All"}
          </Link>
        ))}
      </nav>
      {pages.length === 0 ? (
        <Empty title={status ? "No pages with this status." : "No pages yet."} />
      ) : (
        <Table head={["Title", "URL", "Status", "Published", "Last modified"]}>
          {pages.map((p) => (
            <tr key={p.id} className="hover:bg-surface/60">
              <td>
                <Link href={`/admin/pages/${p.id}`} className="font-semibold text-ink hover:text-brand">
                  {p.title}
                </Link>
              </td>
              <td className="font-mono text-xs text-muted">/{p.slug}</td>
              <td>
                <StatusBadge status={p.status} map={PAGE_STATUS_LABELS} />
              </td>
              <td className="whitespace-nowrap text-ink-soft">{p.published_at ? formatDateTime(p.published_at) : "—"}</td>
              <td className="whitespace-nowrap text-ink-soft">{formatDateTime(p.updated_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
