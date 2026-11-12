import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, isoToManilaLocal } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { AD_PLACEMENT_LABELS, AD_PLACEMENTS, AD_STATUS, adStatus, type AdPlacement, type AdStatus } from "@/lib/studio/ads";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import {
  Badge,
  Empty,
  Field,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  RecordList,
  RecordMeta,
  RecordRow,
  RecordTitle,
  Toolbar,
  ToolbarSearch,
  ToolbarTabs,
  withParams,
} from "@/components/studio/ui";
import { createAdSlot, deleteAdSlot, toggleAdSlot, updateAdSlot } from "./actions";

export const metadata: Metadata = { title: "Ad inventory" };

const PAGE_SIZE = 12; // as in the Newsmaker console
// shortcut: the status is derived (active flag + date window), so the status tabs, the search and the paging all run
// in memory over at most MAX_ROWS slots. Move them into the query if direct-sold inventory grows past this.
const MAX_ROWS = 200;
const STATUSES = Object.keys(AD_STATUS) as AdStatus[];
/** Row buttons: SubmitButton sets its own size, so the smaller one needs `!`. */
const SMALL = "!min-h-9 !px-3 !text-[13px]";
/** Keeps a long action message from widening the row's button column. */
const ROW_FORM = "max-w-[13rem]";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

interface AdRow {
  id: string;
  name: string;
  placement: string;
  image_id: string;
  alt_text: string | null;
  destination_url: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  updated_at: string;
  image: { id: string; storage_path: string | null; external_url: string | null; alt_text: string | null; file_name: string } | null;
}

/**
 * Ad inventory in the Newsmaker console's shape (ADR-021): the list with status tabs and search on the left,
 * the create form always open on the right. Boses has no status column: a slot is on or off with an optional
 * date window, and adStatus() derives Live / Scheduled / Expired / Inactive from that.
 */
export default async function AdsPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage("ads.manage");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 120);
  const status = STATUSES.find((s) => s === one(sp.status));

  const { data, error } = await ctx.supabase
    .from("ad_slots")
    .select(
      "id, name, placement, image_id, alt_text, destination_url, is_active, starts_at, ends_at, sort_order, updated_at, image:media_assets(id, storage_path, external_url, alt_text, file_name)",
    )
    .order("placement")
    .order("sort_order")
    .order("created_at")
    .limit(MAX_ROWS);
  if (error) throw error;
  const now = new Date();
  const all = ((data ?? []) as unknown as AdRow[]).map((r) => ({ r, status: adStatus(r, now) }));

  const needle = q.toLowerCase();
  const matches = all.filter(
    (a) => (!status || a.status === status) && (!needle || a.r.name.toLowerCase().includes(needle) || a.r.destination_url.toLowerCase().includes(needle)),
  );
  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page past the end (a stale link, or the last slot on a page deleted) falls back to the last page.
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const rows = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader eyebrow="Commercial inventory" title="Ad inventory" description="Manage publication ad placements and destinations." />

      <div className="grid items-start gap-6 min-[1101px]:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]">
        {/* @container: the toolbar below stacks by the panel's width, which is narrow beside the create form. */}
        <Panel flush className="@container min-w-0">
          <Toolbar>
            <div className="flex min-w-0 flex-1 flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
              <ToolbarTabs
                label="Ad status"
                tabs={[undefined, ...STATUSES].map((s) => ({
                  key: s ?? "all",
                  label: s ? AD_STATUS[s].label : "All",
                  href: withParams("/admin/ads", { q, status: s }),
                  current: s === status,
                }))}
              />
              <ToolbarSearch action="/admin/ads" label="Search ad inventory" placeholder="Search ad slots…" defaultValue={q} hidden={{ status }} />
            </div>
          </Toolbar>

          {all.length === MAX_ROWS && (
            <div className="border-b border-line px-5 py-3">
              <Notice tone="warn">Only the first {MAX_ROWS} ad slots are loaded here.</Notice>
            </div>
          )}

          {rows.length === 0 ? (
            <Empty bare title="No ad slots found">
              {q || status ? "Try another search or status." : "Create the first placement beside this list."}
            </Empty>
          ) : (
            <RecordList label="Ad slots">
              {rows.map((a) => (
                <AdRecord key={a.r.id} r={a.r} status={a.status} />
              ))}
            </RecordList>
          )}

          <div className="border-t border-line">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              noun={total === 1 ? "ad slot" : "ad slots"}
              hrefFor={(p) => withParams("/admin/ads", { q, status, page: p })}
            />
          </div>
        </Panel>

        <Panel title="Create ad" description="New ads are saved with the settings below." className="min-w-0">
          <ActionForm action={createAdSlot} resetOnSuccess>
            <AdFields idPrefix="new" />
            <div className="mt-5">
              <SubmitButton>Create ad</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <p className="mt-[18px] text-[13px] leading-[1.55] text-muted">
        One live ad is shown per placement: the lowest order number wins, then the oldest. Ads are labelled “Anunsyo” / “Advertisement” on the public site and
        open in a new tab as sponsored links. Times are Asia/Manila.
      </p>
    </>
  );
}

function windowLabel(r: AdRow): string {
  const from = r.starts_at ? `From ${formatDateTime(r.starts_at)}` : null;
  const until = r.ends_at ? `Until ${formatDateTime(r.ends_at)}` : "No end date";
  return [from, until].filter(Boolean).join(" · ");
}

function AdRecord({ r, status }: { r: AdRow; status: AdStatus }) {
  const thumb = mediaUrl(r.image);
  const badge = AD_STATUS[status];
  return (
    // The buttons are laid out here, not in RecordRow's `actions` slot: beside the create form the list is narrow,
    // so they drop under the ad by the panel's width, and the editor below gets the full width of the row.
    <RecordRow>
      <div className="flex flex-col gap-x-7 gap-y-4 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment
            <img src={thumb} alt="" className="h-14 w-20 shrink-0 rounded-[5px] bg-surface-2 object-cover" loading="lazy" />
          )}
          <div className="min-w-0">
            <RecordMeta>
              <Badge tone={badge.tone}>{badge.label}</Badge>
              <span className="font-bold uppercase tracking-[0.35px] text-brand-700">{AD_PLACEMENT_LABELS[r.placement as AdPlacement] ?? r.placement}</span>
            </RecordMeta>
            <RecordTitle>{r.name}</RecordTitle>
            <p className="text-[13px] leading-[1.55] text-ink-soft">
              {windowLabel(r)} · <span className="tabular-nums">Order {r.sort_order}</span>
            </p>
            <p className="mt-1 text-xs text-muted">Updated {formatDateTime(r.updated_at)}</p>
            <p className="mt-3 text-[13px] font-bold">
              <a href={r.destination_url} target="_blank" rel="noopener noreferrer" title={r.destination_url} className="text-brand hover:underline">
                Open destination <span aria-hidden="true">↗</span>
              </a>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          <ActionForm action={toggleAdSlot} className={ROW_FORM}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="outline" pendingLabel="Updating…" className={SMALL}>
              {r.is_active ? "Deactivate" : "Activate"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteAdSlot} confirm={`Delete the ad “${r.name}”? This can't be undone.`} className={ROW_FORM}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="danger" pendingLabel="Deleting…" className={SMALL}>
              Delete
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      {/* In the row's flow, not a popover: the flush panel clips anything that overflows it. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-bold text-brand hover:underline">Edit ad</summary>
        <div className="mt-3 rounded-[7px] border border-line bg-surface p-4">
          <ActionForm action={updateAdSlot}>
            <input type="hidden" name="id" value={r.id} />
            <AdFields idPrefix={r.id} r={r} />
            <div className="mt-5">
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>
    </RecordRow>
  );
}

/** One column in the narrow create panel and row editor, two when the form has the room (container query). */
function AdFields({ idPrefix, r }: { idPrefix: string; r?: AdRow }) {
  const picked: PickedMedia | null = r?.image
    ? { id: r.image.id, url: mediaUrl(r.image), alt_text: r.image.alt_text, file_name: r.image.file_name }
    : null;
  return (
    <div className="@container">
      <div className="grid gap-4 @lg:grid-cols-2">
        <Field label="Name" htmlFor={`${idPrefix}-name`} hint="Internal name, e.g. advertiser and campaign.">
          <input id={`${idPrefix}-name`} name="name" required maxLength={120} defaultValue={r?.name} className="field" />
        </Field>
        <Field label="Placement" htmlFor={`${idPrefix}-placement`}>
          <select id={`${idPrefix}-placement`} name="placement" defaultValue={r?.placement ?? "home"} className="field">
            {AD_PLACEMENTS.map((p) => (
              <option key={p} value={p}>
                {AD_PLACEMENT_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <MediaPicker name="image_id" label="Ad image" defaultValue={picked} />
        <div className="space-y-4">
          <Field label="Alt text" htmlFor={`${idPrefix}-alt`} hint="Describe the ad for screen readers. Defaults to the image's alt text.">
            <input id={`${idPrefix}-alt`} name="alt_text" maxLength={300} defaultValue={r?.alt_text ?? ""} className="field" />
          </Field>
          <Field label="Destination URL" htmlFor={`${idPrefix}-dst`} hint="Must start with https://.">
            <input
              id={`${idPrefix}-dst`}
              name="destination_url"
              type="url"
              required
              maxLength={2048}
              defaultValue={r?.destination_url}
              placeholder="https://"
              className="field font-mono text-sm"
            />
          </Field>
        </div>
        <Field label="Starts" htmlFor={`${idPrefix}-start`} hint="Optional. Empty = immediately.">
          <input id={`${idPrefix}-start`} name="starts_at" type="datetime-local" defaultValue={isoToManilaLocal(r?.starts_at)} className="field" />
        </Field>
        <Field label="Ends" htmlFor={`${idPrefix}-end`} hint="Optional. Empty = no end.">
          <input id={`${idPrefix}-end`} name="ends_at" type="datetime-local" defaultValue={isoToManilaLocal(r?.ends_at)} className="field" />
        </Field>
        <Field label="Order" htmlFor={`${idPrefix}-order`} hint="Lower shows first.">
          <input id={`${idPrefix}-order`} name="sort_order" type="number" min={-1000} max={1000} step={1} defaultValue={r?.sort_order ?? 0} className="field" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink @lg:items-end @lg:pb-3">
          <input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? false} className="h-4 w-4" /> Active
        </label>
      </div>
    </div>
  );
}
