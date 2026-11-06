"use client";

import { ARTICLE_SOURCES } from "@/lib/homepage/blocks";
import type { BlockFormProps } from "../types";
import { ArticlePicker, CheckField, LinkField, MultiOptionField, NumberField, OptionSelect, SelectField } from "./fields";

const SOURCE_LABELS: Record<(typeof ARTICLE_SOURCES)[number], string> = {
  latest: "Pinakabago",
  featured: "Featured",
  editors_picks: "Pili ng Editor",
  breaking: "Breaking",
  category: "Ayon sa kategorya",
  manual: "Manwal na pagpili",
  most_read: "Pinakabinasa",
};

/** latest_articles, article_grid and editors_picks share one settings schema. */
export function ArticleListForm({ value, onChange, options }: BlockFormProps<"latest_articles">) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Pinagmulan"
          value={value.source}
          onChange={(v) => set("source", v || "latest")}
          options={ARTICLE_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
        />
        <OptionSelect label="Kategorya" value={value.category_id} onChange={(v) => set("category_id", v)} options={options.categories} noneLabel="Lahat" />
        <NumberField label="Bilang" value={value.limit} onChange={(v) => set("limit", v)} min={1} max={24} />
      </div>
      {value.source === "category" && !value.category_id && <p className="text-xs text-amber-700">Pumili ng kategorya para sa pinagmulang ito.</p>}
      {value.source === "manual" && (
        <ArticlePicker label="Mga artikulo" value={value.article_ids} onChange={(v) => set("article_ids", v)} max={24} options={options} />
      )}
      <LinkField label="Tingnan lahat na link" value={value.view_all} onChange={(v) => set("view_all", v)} />
      <CheckField
        label="Ipakita ang Pinakabinasa sa gilid (Pinakabagong Balita lamang; nakatago kapag wala pang datos)"
        checked={value.with_sidebar}
        onChange={(v) => set("with_sidebar", v)}
      />
    </div>
  );
}

export function TopStoriesForm({ value, onChange, options }: BlockFormProps<"top_stories">) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Pangunahing balita"
          value={value.lead_source}
          onChange={(v) => set("lead_source", v || "featured")}
          options={[
            { value: "featured", label: "Pinakabagong featured" },
            { value: "latest", label: "Pinakabago" },
            { value: "manual", label: "Manwal na pagpili" },
          ]}
        />
        <NumberField label="Balita sa gilid" value={value.rail_count} onChange={(v) => set("rail_count", v)} min={0} max={6} />
        <NumberField label="Balita sa ibaba" value={value.below_count} onChange={(v) => set("below_count", v)} min={0} max={6} />
      </div>
      {value.lead_source === "manual" && (
        <ArticlePicker
          label="Artikulo"
          value={value.lead_article_id ? [value.lead_article_id] : []}
          onChange={(v) => set("lead_article_id", v.at(-1) ?? null)}
          max={1}
          options={options}
        />
      )}
      <p className="text-xs text-muted">Ang iba pang balita ay ang pinakabagong nailathala, hindi kasama ang pangunahing balita.</p>
    </div>
  );
}

export function FeaturedStoryForm({ value, onChange, options }: BlockFormProps<"featured_story">) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Pinagmulan"
        value={value.source}
        onChange={(v) => onChange({ ...value, source: v || "featured" })}
        options={[
          { value: "featured", label: "Pinakabagong featured" },
          { value: "latest", label: "Pinakabago" },
          { value: "manual", label: "Manwal na pagpili" },
        ]}
      />
      {value.source === "manual" && (
        <ArticlePicker
          label="Artikulo"
          value={value.article_id ? [value.article_id] : []}
          onChange={(v) => onChange({ ...value, article_id: v.at(-1) ?? null })}
          max={1}
          options={options}
        />
      )}
    </div>
  );
}

export function BreakingForm({ value, onChange }: BlockFormProps<"breaking_news">) {
  return <NumberField label="Bilang ng breaking stories" value={value.limit} onChange={(v) => onChange({ ...value, limit: v })} min={1} max={10} />;
}

export function TrendingForm({ value, onChange }: BlockFormProps<"trending_topics">) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Ang mga paksa ay pinamamahalaan sa Kategorya at Tag → Trending topics.</p>
      <LinkField label="Tingnan lahat na link" value={value.view_all} onChange={(v) => onChange({ ...value, view_all: v })} />
    </div>
  );
}

export function CategoryShowcaseForm({ value, onChange, options }: BlockFormProps<"category_showcase">) {
  return (
    <div className="space-y-4">
      <MultiOptionField
        label="Mga kategorya"
        value={value.category_ids}
        onChange={(v) => onChange({ ...value, category_ids: v })}
        options={options.categories}
        max={8}
      />
      <NumberField label="Artikulo bawat kategorya" value={value.per_category} onChange={(v) => onChange({ ...value, per_category: v })} min={1} max={6} />
    </div>
  );
}

export function MostReadForm({ value, onChange }: BlockFormProps<"most_read">) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField label="Saklaw (araw)" value={value.days} onChange={(v) => onChange({ ...value, days: v })} min={1} max={90} />
      <NumberField label="Bilang" value={value.limit} onChange={(v) => onChange({ ...value, limit: v })} min={1} max={10} />
    </div>
  );
}

export function RegionalForm({ value, onChange, options }: BlockFormProps<"regional_news">) {
  return (
    <div className="space-y-4">
      <MultiOptionField
        label="Mga lugar"
        value={value.location_ids}
        onChange={(v) => onChange({ ...value, location_ids: v })}
        options={options.locations}
        max={6}
      />
      <NumberField label="Artikulo bawat lugar" value={value.per_location} onChange={(v) => onChange({ ...value, per_location: v })} min={1} max={6} />
    </div>
  );
}
