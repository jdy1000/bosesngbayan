import Link from "next/link";

/**
 * Server-safe Studio primitives. Metrics follow the Newsmaker console (ADR-021): 10px-radius bordered
 * panels, a 10px kicker over a 28px title, pill tabs, dot status badges and a text pager. Colours stay on
 * the Boses tokens, so the dark theme keeps working.
 */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
}: {
  title: string;
  /** Small uppercase kicker above the title. */
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
      <div className="min-w-0">
        {eyebrow && !breadcrumb?.length && <Kicker>{eyebrow}</Kicker>}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
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
        <h1 className="mt-[3px] text-[26px] font-bold leading-[1.2] tracking-[-0.8px] text-ink md:text-[28px]">{title}</h1>
        {description && <p className="mt-[7px] max-w-3xl text-[15px] leading-[1.55] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** 10px uppercase label in the brand colour, used above page and section titles. */
export function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.125em] text-brand">{children}</p>;
}

/** Kicker + 18px title that opens a section of a page (not a panel). */
export function SectionHeading({ kicker, title, id }: { kicker?: string; title: string; id?: string }) {
  return (
    <div className="mb-3.5">
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2 id={id} className="mt-1 text-lg font-semibold tracking-[-0.6px] text-ink">
        {title}
      </h2>
    </div>
  );
}

/** Plain pill beside a page title, e.g. "Access: Editor". */
export function AccessChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex shrink-0 items-center rounded-full border border-line bg-paper px-3 py-[7px] text-xs text-muted">{children}</span>;
}

const PANEL = "rounded-[10px] border border-line bg-paper shadow-panel";

/**
 * Card with an optional header. `flush` removes the body padding for lists, tables and toolbars that run
 * edge to edge; it also clips to the rounded corners, so do not put popovers inside a flush panel.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  flush = false,
  labelledBy,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
  /** id for the title, so a section can point at it with aria-labelledby. */
  labelledBy?: string;
}) {
  return (
    <section aria-labelledby={title && labelledBy ? labelledBy : undefined} className={`${PANEL} ${flush ? "overflow-hidden" : ""} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b border-line px-[22px] py-[19px]">
          <div className="min-w-0">
            {title && (
              <h2 id={labelledBy} className="text-lg font-semibold text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-[5px] text-[13px] leading-[1.55] text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? "" : "px-[22px] pb-[22px] pt-5"}>{children}</div>
    </section>
  );
}

/** One bordered strip of figures divided by hairlines. Pass <Stat> cells. */
export function StatStrip({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div
      aria-label={label}
      role={label ? "group" : undefined}
      className={`${PANEL} grid grid-cols-2 overflow-hidden min-[521px]:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] [&>*]:border-b [&>*]:border-r [&>*]:border-line`}
    >
      {children}
    </div>
  );
}

/** A figure in a StatStrip. With `href` the whole cell is a link. */
export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <span className="text-xs text-muted">{label}</span>
      <strong className={`text-2xl font-bold leading-[1.2] tracking-[-0.8px] tabular-nums text-ink min-[521px]:text-[28px] ${href ? "transition-colors group-hover:text-brand" : ""}`}>{value}</strong>
      {hint && <small className="text-xs text-muted">{hint}</small>}
    </>
  );
  // -mb/-mr px hide the trailing hairlines under the strip's own border (the strip clips its overflow).
  const cell = "-mb-px -mr-px grid content-start gap-[5px] px-[15px] py-[15px] min-[521px]:px-5 min-[521px]:py-[18px]";
  return href ? (
    <Link href={href} className={`group ${cell} transition-colors hover:bg-brand-50`}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
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

/** Status pill: a dot in the text colour, then the label. The label carries the meaning; the colour only repeats it. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[9px] py-[5px] text-[11px] font-bold leading-none ${TONES[tone]}`}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export const ARTICLE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_review: { label: "In review", tone: "amber" },
  // Blue, not green: Boses keeps "approved" apart from "published" (Newsmaker has no approved state).
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

/** Empty state. `bare` drops the card, for use inside a Panel. */
export function Empty({ title, children, bare = false }: { title: string; children?: React.ReactNode; bare?: boolean }) {
  return (
    <div className={`px-[22px] py-11 text-center ${bare ? "" : PANEL}`}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children && <div className="mx-auto mt-[7px] max-w-[450px] text-[15px] leading-[1.55] text-muted">{children}</div>}
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
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

/**
 * Tabs + search in one bar at the top of a flush Panel. Either side can be left out.
 * The search form is a plain GET form: pass hidden inputs as `searchHidden` to keep other filters.
 */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 min-[761px]:flex-row min-[761px]:items-center min-[761px]:justify-between">{children}</div>;
}

/** Pill tabs for a status or section filter. The current tab is tinted in the brand colour. */
export function ToolbarTabs({ label, tabs }: { label: string; tabs: { key: string; label: React.ReactNode; href: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.current ? "page" : undefined}
          className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors ${
            t.current ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function ToolbarSearch({ action, label, placeholder, defaultValue, hidden }: { action: string; label: string; placeholder: string; defaultValue?: string; hidden?: Record<string, string | undefined> }) {
  const id = `search-${action.replace(/[^a-z]/gi, "-")}`;
  return (
    <form action={action} method="get" role="search" className="flex min-w-0 flex-none items-center gap-2 min-[761px]:w-[330px]">
      {Object.entries(hidden ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} name="q" type="search" defaultValue={defaultValue} maxLength={120} placeholder={placeholder} className="field min-w-0 flex-1" />
      <button type="submit" className="btn btn-primary px-3.5">
        Search
      </button>
    </form>
  );
}

/** Plain table shell: pass <tr> rows. Scrolls horizontally on small screens instead of breaking layout. */
export function Table({ head, children, plain = false }: { head: React.ReactNode[]; children: React.ReactNode; plain?: boolean }) {
  return (
    // relative: keeps absolutely positioned children (sr-only labels) inside the scroll area instead of widening the page.
    <div className={plain ? "relative overflow-x-auto" : `relative overflow-x-auto ${PANEL}`}>
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="border-b border-line bg-surface text-[11px] font-bold uppercase tracking-[0.35px] text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-[18px] py-3.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-[18px] [&_td]:py-3.5 [&_td]:align-middle">{children}</tbody>
      </table>
    </div>
  );
}

/** A list of records inside a flush Panel: one bordered row per record. */
export function RecordList({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line">
      {children}
    </ul>
  );
}

/**
 * One record: what it is on the left (meta row, title, body) and what you can do on the right.
 * Stacks below 761px.
 */
export function RecordRow({ children, actions, compact = false }: { children: React.ReactNode; actions?: React.ReactNode; compact?: boolean }) {
  return (
    <li className={`flex flex-col gap-x-7 gap-y-4 px-[22px] py-5 min-[761px]:flex-row min-[761px]:justify-between ${compact ? "min-[761px]:items-center" : "min-[761px]:items-start"}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 flex-wrap items-start gap-2">{actions}</div>}
    </li>
  );
}

/** Badge + small facts above a record's title. */
export function RecordMeta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">{children}</div>;
}

export function RecordTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-2 text-[17px] font-semibold leading-[1.35] text-ink">{children}</h3>;
}

/**
 * List footer: "21–40 of 57 articles" and Previous · 2 / 3 · Next. Pass `total` + `pageSize` + `noun` when the
 * count is known; without them it shows "Page x of y" and hides itself on a single page.
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
  if (pages <= 1 && total === undefined) return null;
  const first = pageSize ? (page - 1) * pageSize + 1 : 0;
  const summary =
    total !== undefined && pageSize
      ? total === 0 || first > total
        ? `${total} ${noun}`
        : `${first}–${Math.min(total, page * pageSize)} of ${total} ${noun}`
      : `Page ${page} of ${pages}`;
  const step = "inline-flex min-h-8 items-center font-bold";
  return (
    <nav aria-label={`${noun} pagination`} className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-[15px] text-xs text-muted">
      <span className="tabular-nums">{summary}</span>
      <div className="flex items-center gap-3.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={`${step} text-brand hover:underline`}>
            ← Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${step} opacity-45`}>
            ← Previous
          </span>
        )}
        <strong className="tabular-nums text-ink">
          {Math.min(page, pages)} / {pages}
        </strong>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={`${step} text-brand hover:underline`}>
            Next →
          </Link>
        ) : (
          <span aria-disabled="true" className={`${step} opacity-45`}>
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs leading-[1.5] text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-accent-700">{error}</p>}
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
