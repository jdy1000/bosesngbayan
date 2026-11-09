import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, isoToManilaLocal } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { AD_PLACEMENT_LABELS, AD_PLACEMENTS, AD_STATUS, adStatus, type AdPlacement } from "@/lib/studio/ads";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import { Badge, Empty, Field, Notice, PageHeader, Panel, Table } from "@/components/studio/ui";
import { createAdSlot, deleteAdSlot, toggleAdSlot, updateAdSlot } from "./actions";

export const metadata: Metadata = { title: "Ad inventory" };
// shortcut: no pagination; direct-sold inventory is small. Add Pagination (components/studio/ui) if it grows past this.
const MAX_ROWS = 200;

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

export default async function AdsPage() {
  const ctx = await requireStaffPage("ads.manage");
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
  const rows = (data ?? []) as unknown as AdRow[];
  const now = new Date();

  return (
    <>
      <PageHeader
        eyebrow="Commercial inventory"
        title="Ad inventory"
        description="Manage publication ad placements and destinations."
      />
      <Panel title="Ads" description="One live ad is shown per placement: the lowest order number wins, then the oldest.">
        <Notice>
          Ads are labelled “Anunsyo” / “Advertisement” on the public site and open in a new tab as sponsored links. Times are Asia/Manila.
        </Notice>
        <details className="my-5 rounded-lg border border-dashed border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand">+ New ad</summary>
          <ActionForm action={createAdSlot} resetOnSuccess className="mt-4">
            <AdFields idPrefix="new" />
            <div className="mt-4">
              <SubmitButton>Create ad</SubmitButton>
            </div>
          </ActionForm>
        </details>

        {rows.length === 0 ? (
          <Empty title="No ads yet.">Create an ad with an image and an https:// destination.</Empty>
        ) : (
          <Table head={["", "Name", "Placement", "Status", "Window", "Destination", ""]}>
            {rows.map((r) => (
              <AdRowView key={r.id} r={r} now={now} />
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}

function WindowLabel({ r }: { r: AdRow }) {
  if (!r.starts_at && !r.ends_at) return <>Always</>;
  return (
    <>
      <span className="block">From {r.starts_at ? formatDateTime(r.starts_at) : "now"}</span>
      <span className="block">Until {r.ends_at ? formatDateTime(r.ends_at) : "no end"}</span>
    </>
  );
}

function AdRowView({ r, now }: { r: AdRow; now: Date }) {
  const thumb = mediaUrl(r.image);
  const status = AD_STATUS[adStatus(r, now)];
  return (
    <tr>
      <td className="w-16">
        <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded-md bg-surface-2">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted" aria-hidden="true" />
          )}
        </div>
      </td>
      <td className="min-w-40 font-semibold text-ink">
        {r.name}
        <span className="block text-xs font-normal text-muted tabular-nums">Order {r.sort_order}</span>
      </td>
      <td>{AD_PLACEMENT_LABELS[r.placement as AdPlacement] ?? r.placement}</td>
      <td>
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
      <td className="min-w-40 text-xs text-muted">
        <WindowLabel r={r} />
      </td>
      <td className="max-w-56 truncate font-mono text-xs">
        <a href={r.destination_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
          {r.destination_url}
        </a>
      </td>
      <td>
        <div className="flex items-center justify-end gap-1">
          <details className="relative">
            <summary className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-surface-2">Edit</summary>
            <div className="absolute right-0 z-10 mt-1 w-[min(640px,85vw)] rounded-xl border border-line bg-paper p-4 shadow-lg">
              <ActionForm action={updateAdSlot}>
                <input type="hidden" name="id" value={r.id} />
                <AdFields idPrefix={r.id} r={r} />
                <div className="mt-4">
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </details>
          <ActionForm action={toggleAdSlot}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="!min-h-8 !px-2 text-xs">
              {r.is_active ? "Deactivate" : "Activate"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteAdSlot} confirm={`Delete the ad “${r.name}”? This can't be undone.`}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="!min-h-8 !px-2 text-xs text-accent-700">
              Delete
            </SubmitButton>
          </ActionForm>
        </div>
      </td>
    </tr>
  );
}

function AdFields({ idPrefix, r }: { idPrefix: string; r?: AdRow }) {
  const picked: PickedMedia | null = r?.image
    ? { id: r.image.id, url: mediaUrl(r.image), alt_text: r.image.alt_text, file_name: r.image.file_name }
    : null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
      <label className="flex items-end gap-2 pb-3 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? false} className="h-4 w-4" /> Active
      </label>
    </div>
  );
}
