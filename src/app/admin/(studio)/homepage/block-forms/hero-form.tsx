"use client";

import type { BlockFormProps } from "../types";
import { CheckField, LinkField, MediaField, OptionSelect, TextField } from "./fields";

export function HeroForm({ value, onChange, options }: BlockFormProps<"hero">) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Eyebrow / label" value={value.eyebrow} onChange={(v) => set("eyebrow", v)} max={60} />
        <TextField label="Highlight na salita" value={value.highlight} onChange={(v) => set("highlight", v)} max={60} hint="Bahagi ng headline na kulay asul." />
      </div>
      <TextField label="Headline" required value={value.headline} onChange={(v) => set("headline", v)} max={160} />
      <TextField label="Paglalarawan" multiline value={value.description} onChange={(v) => set("description", v)} max={400} />
      <div className="grid gap-4 md:grid-cols-2">
        <LinkField label="Pangunahing CTA" value={value.primary_cta} onChange={(v) => set("primary_cta", v)} />
        <LinkField label="Pangalawang CTA" value={value.secondary_cta} onChange={(v) => set("secondary_cta", v)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MediaField label="Larawan ng hero" value={value.image_id} onChange={(v) => set("image_id", v)} options={options} />
        <OptionSelect
          label="Tampok na botohan"
          value={value.poll_id}
          onChange={(v) => set("poll_id", v)}
          options={options.polls}
          noneLabel="Awtomatiko (featured poll)"
        />
      </div>
      <CheckField
        label="Ipakita ang kabuuang bilang ng boto"
        checked={value.show_participation_count}
        onChange={(v) => set("show_participation_count", v)}
      />
      {value.show_participation_count && (
        <TextField
          label="Label ng bilang"
          value={value.participation_label}
          onChange={(v) => set("participation_label", v)}
          max={120}
          hint="Aktwal na bilang ng boto mula sa database ang ipapakita."
        />
      )}
    </div>
  );
}
