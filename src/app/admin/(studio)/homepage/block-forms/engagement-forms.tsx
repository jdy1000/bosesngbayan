"use client";

import { CTA_ICONS } from "@/lib/homepage/blocks";
import type { BlockFormProps } from "../types";
import { CheckField, LinkField, MediaField, NumberField, OptionSelect, SelectField, TextField } from "./fields";

export function PollShowcaseForm({ value, onChange, options }: BlockFormProps<"poll_showcase">) {
  return (
    <div className="space-y-4">
      <OptionSelect
        label="Featured poll"
        value={value.poll_id}
        onChange={(v) => onChange({ ...value, poll_id: v })}
        options={options.polls}
        noneLabel="Automatic (featured poll)"
      />
      <CheckField label="Show the list of active polls" checked={value.show_active_list} onChange={(v) => onChange({ ...value, show_active_list: v })} />
      <NumberField label="Number in list" value={value.limit} onChange={(v) => onChange({ ...value, limit: v })} min={1} max={6} />
    </div>
  );
}

export function CommunityForm({ value, onChange }: BlockFormProps<"community">) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Number of posts" value={value.limit} onChange={(v) => onChange({ ...value, limit: v })} min={1} max={12} />
        <CheckField label="Featured only" checked={value.featured_only} onChange={(v) => onChange({ ...value, featured_only: v })} />
      </div>
      <LinkField label="CTA" value={value.cta} onChange={(v) => onChange({ ...value, cta: v })} />
    </div>
  );
}

export function NewsletterForm({ value, onChange }: BlockFormProps<"newsletter">) {
  return (
    <TextField
      label="Source tag"
      value={value.source}
      onChange={(v) => onChange({ ...value, source: v })}
      max={40}
      hint="Stored with the subscription to show where people signed up."
    />
  );
}

const VARIANTS = [
  { value: "simple", label: "Simple" },
  { value: "banner", label: "Banner" },
  { value: "feature_tiles", label: "Feature tiles" },
] as const;

export function CustomCtaForm({ value, onChange, options }: BlockFormProps<"custom_cta">) {
  const setItem = (i: number, patch: Partial<(typeof value.items)[number]>) =>
    onChange({ ...value, items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Variant" value={value.variant} onChange={(v) => onChange({ ...value, variant: v || "simple" })} options={VARIANTS} />
        <LinkField label="CTA" value={value.cta} onChange={(v) => onChange({ ...value, cta: v })} />
      </div>
      <MediaField label="Image" value={value.image_id} onChange={(v) => onChange({ ...value, image_id: v })} options={options} />
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink">Items ({value.items.length}/6)</legend>
        {value.items.map((it, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[160px_1fr_auto]">
            <SelectField label="Icon" value={it.icon} onChange={(v) => setItem(i, { icon: v || "chart" })} options={CTA_ICONS.map((c) => ({ value: c, label: c }))} />
            <TextField label="Label" value={it.label} onChange={(v) => setItem(i, { label: v })} max={80} />
            <button
              type="button"
              onClick={() => onChange({ ...value, items: value.items.filter((_, j) => j !== i) })}
              className="btn min-h-10 px-3 text-sm text-accent-700 hover:bg-surface-2"
            >
              Remove
            </button>
          </div>
        ))}
        {value.items.length < 6 && (
          <button type="button" onClick={() => onChange({ ...value, items: [...value.items, { icon: "chart", label: "" }] })} className="btn btn-outline min-h-9 px-3 text-sm">
            + Add item
          </button>
        )}
      </fieldset>
    </div>
  );
}
