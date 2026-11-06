"use client";

import { ARTICLE_SOURCES } from "@/lib/homepage/blocks";
import type { BlockFormProps } from "../types";
import { ArticlePicker, CheckField, LinkField, MultiOptionField, NumberField, OptionSelect, SelectField } from "./fields";

const SOURCE_LABELS: Record<(typeof ARTICLE_SOURCES)[number], string> = {
  latest: "Latest",
  featured: "Featured",
  editors_picks: "Editor's picks",
  breaking: "Breaking",
  category: "By category",
  manual: "Manual selection",
  most_read: "Most read",
};

/** latest_articles, article_grid and editors_picks share one settings schema. */
export function ArticleListForm({ value, onChange, options }: BlockFormProps<"latest_articles">) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Source"
          value={value.source}
          onChange={(v) => set("source", v || "latest")}
          options={ARTICLE_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
        />
        <OptionSelect label="Category" value={value.category_id} onChange={(v) => set("category_id", v)} options={options.categories} noneLabel="All" />
        <NumberField label="Count" value={value.limit} onChange={(v) => set("limit", v)} min={1} max={24} />
      </div>
      {value.source === "category" && !value.category_id && <p className="text-xs text-amber-700">Choose a category for this source.</p>}
      {value.source === "manual" && (
        <ArticlePicker label="Articles" value={value.article_ids} onChange={(v) => set("article_ids", v)} max={24} options={options} />
      )}
      <LinkField label="View-all link" value={value.view_all} onChange={(v) => set("view_all", v)} />
      <CheckField
        label="Show Most Read in a sidebar (Latest News only; hidden until there is data)"
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
          label="Lead story"
          value={value.lead_source}
          onChange={(v) => set("lead_source", v || "featured")}
          options={[
            { value: "featured", label: "Latest featured" },
            { value: "latest", label: "Latest" },
            { value: "manual", label: "Manual selection" },
          ]}
        />
        <NumberField label="Side rail stories" value={value.rail_count} onChange={(v) => set("rail_count", v)} min={0} max={6} />
        <NumberField label="Stories below" value={value.below_count} onChange={(v) => set("below_count", v)} min={0} max={6} />
      </div>
      {value.lead_source === "manual" && (
        <ArticlePicker
          label="Article"
          value={value.lead_article_id ? [value.lead_article_id] : []}
          onChange={(v) => set("lead_article_id", v.at(-1) ?? null)}
          max={1}
          options={options}
        />
      )}
      <p className="text-xs text-muted">The other stories are the most recently published, excluding the lead story.</p>
    </div>
  );
}

export function FeaturedStoryForm({ value, onChange, options }: BlockFormProps<"featured_story">) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Source"
        value={value.source}
        onChange={(v) => onChange({ ...value, source: v || "featured" })}
        options={[
          { value: "featured", label: "Latest featured" },
          { value: "latest", label: "Latest" },
          { value: "manual", label: "Manual selection" },
        ]}
      />
      {value.source === "manual" && (
        <ArticlePicker
          label="Article"
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
  return <NumberField label="Number of breaking stories" value={value.limit} onChange={(v) => onChange({ ...value, limit: v })} min={1} max={10} />;
}

export function TrendingForm({ value, onChange }: BlockFormProps<"trending_topics">) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Topics are managed under Categories & tags → Trending topics.</p>
      <LinkField label="View-all link" value={value.view_all} onChange={(v) => onChange({ ...value, view_all: v })} />
    </div>
  );
}

export function CategoryShowcaseForm({ value, onChange, options }: BlockFormProps<"category_showcase">) {
  return (
    <div className="space-y-4">
      <MultiOptionField
        label="Categories"
        value={value.category_ids}
        onChange={(v) => onChange({ ...value, category_ids: v })}
        options={options.categories}
        max={8}
      />
      <NumberField label="Articles per category" value={value.per_category} onChange={(v) => onChange({ ...value, per_category: v })} min={1} max={6} />
    </div>
  );
}

export function MostReadForm({ value, onChange }: BlockFormProps<"most_read">) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField label="Range (days)" value={value.days} onChange={(v) => onChange({ ...value, days: v })} min={1} max={90} />
      <NumberField label="Count" value={value.limit} onChange={(v) => onChange({ ...value, limit: v })} min={1} max={10} />
    </div>
  );
}

export function RegionalForm({ value, onChange, options }: BlockFormProps<"regional_news">) {
  return (
    <div className="space-y-4">
      <MultiOptionField
        label="Places"
        value={value.location_ids}
        onChange={(v) => onChange({ ...value, location_ids: v })}
        options={options.locations}
        max={6}
      />
      <NumberField label="Articles per place" value={value.per_location} onChange={(v) => onChange({ ...value, per_location: v })} min={1} max={6} />
    </div>
  );
}
