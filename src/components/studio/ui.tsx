import Link from "next/link";

/** Server-safe Studio primitives. Keep Studio screens consistent: one header, quiet panels, clear statuses. */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
}: {
  title: string;
  /** Small uppercase kicker above the title (Newsmaker console style). */
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && !breadcrumb?.length && <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-brand">{eyebrow}</p>}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 text-sm text-muted">
            {breadcrumb.map((b, i) => (
              <span key={b.href}>
                {i > 0 && <span aria-hidden="true"> / </span>}
                <Link href={b.href} className="hover:text-brand">
                  {b.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, actions, children, className = "" }: { title?: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-paper shadow-card ring-1 ring-line ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-base font-bold text-navy">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-ink-soft",
  blue: "bg-brand-100 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-accent-700",
  navy: "bg-navy text-white",
} as const;
export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export const ARTICLE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_review: { label: "In review", tone: "amber" },
  approved: { label: "Approved", tone: "blue" },
  rejected: { label: "Rejected", tone: "red" },
  scheduled: { label: "Scheduled", tone: "blue" },
  published: { label: "Published", tone: "green" },
  archived: { label: "Archived", tone: "neutral" },
};

export function StatusBadge({ status, map = ARTICLE_STATUS }: { status: string; map?: Record<string, { label: string; tone: BadgeTone }> }) {
  const s = map[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper px-6 py-12 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const cls = {
    info: "border-brand-200 bg-brand-50 text-brand-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-accent-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/** Plain table shell: pass <tr> rows. Scrolls horizontally on small screens instead of breaking layout. */
export function Table({ head, children, plain = false }: { head: React.ReactNode[]; children: React.ReactNode; plain?: boolean }) {
  return (
    <div className={plain ? "overflow-x-auto" : "overflow-x-auto rounded-2xl bg-paper shadow-card ring-1 ring-line"}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * List footer: "21–40 of 57 articles" and Previous · 2 / 3 · Next. Pass `total` + `pageSize` + `noun` when the
 * count is known; without them it shows "Page x of y". Hidden for a single page unless the total is known.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  total,
  pageSize,
  noun = "items",
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  total?: number;
  pageSize?: number;
  noun?: string;
}) {
  const pages = Math.max(1, totalPages);
  if (total === 0 || (pages <= 1 && total === undefined)) return null;
  const first = pageSize ? (page - 1) * pageSize + 1 : 0;
  const summary =
    total !== undefined && pageSize
      ? first > total
        ? `${total} ${noun}`
        : `${first}–${Math.min(total, page * pageSize)} of ${total} ${noun}`
      : `Page ${page} of ${pages}`;
  const step = "rounded-full px-3 py-1.5 font-semibold";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm">
      <span className="tabular-nums text-muted">{summary}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={`${step} text-ink hover:bg-surface-2`}>
              ← Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={`${step} text-muted/60`}>
              ← Previous
            </span>
          )}
          <span className="px-2 font-semibold tabular-nums text-ink">
            {Math.min(page, pages)} / {pages}
          </span>
          {page < pages ? (
            <Link href={hrefFor(page + 1)} className={`${step} text-ink hover:bg-surface-2`}>
              Next →
            </Link>
          ) : (
            <span aria-disabled="true" className={`${step} text-muted/60`}>
              Next →
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-accent-700">{error}</p>}
    </div>
  );
}

/** Builds a query-string href preserving other params. */
export function withParams(base: string, params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
