"use client";

import type { BlockFormProps } from "../types";
import { CheckField, LinkField, MediaField, OptionSelect, TextField } from "./fields";

export function HeroForm({ value, onChange, options }: BlockFormProps<"hero">) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Eyebrow / label" value={value.eyebrow} onChange={(v) => set("eyebrow", v)} max={60} />
        <TextField label="Highlight word" value={value.highlight} onChange={(v) => set("highlight", v)} max={60} hint="Part of the headline shown in blue." />
      </div>
      <TextField label="Headline" required value={value.headline} onChange={(v) => set("headline", v)} max={160} />
      <TextField label="Description" multiline value={value.description} onChange={(v) => set("description", v)} max={400} />
      <div className="grid gap-4 md:grid-cols-2">
        <LinkField label="Primary CTA" value={value.primary_cta} onChange={(v) => set("primary_cta", v)} />
        <LinkField label="Secondary CTA" value={value.secondary_cta} onChange={(v) => set("secondary_cta", v)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MediaField label="Hero image" value={value.image_id} onChange={(v) => set("image_id", v)} options={options} />
        <OptionSelect
          label="Featured poll"
          value={value.poll_id}
          onChange={(v) => set("poll_id", v)}
          options={options.polls}
          noneLabel="Automatic (featured poll)"
        />
      </div>
      <CheckField
        label="Show the total vote count"
        checked={value.show_participation_count}
        onChange={(v) => set("show_participation_count", v)}
      />
      {value.show_participation_count && (
        <TextField
          label="Count label"
          value={value.participation_label}
          onChange={(v) => set("participation_label", v)}
          max={120}
          hint="Shows the actual vote count from the database."
        />
      )}
    </div>
  );
}
