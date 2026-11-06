"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { BLOCK_LABELS, BLOCK_SETTINGS_SCHEMAS, defaultSettings, isBlockType, type BlockSettings, type BlockType } from "@/lib/homepage/blocks";
import type { BuilderOptions, BuilderSection } from "./types";
import { deleteSection, moveSection, toggleSection, updateSection } from "./actions";
import { HeroForm } from "./block-forms/hero-form";
import { ArticleListForm, BreakingForm, CategoryShowcaseForm, FeaturedStoryForm, MostReadForm, RegionalForm, TopStoriesForm, TrendingForm } from "./block-forms/article-forms";
import { CommunityForm, CustomCtaForm, NewsletterForm, PollShowcaseForm } from "./block-forms/engagement-forms";
import { NewsQuizForm, PhotoOfDayForm, QuoteOfDayForm } from "./block-forms/module-forms";

/** Start from the stored settings; fill gaps from defaults so a broken section can still be repaired. */
function initialSettings(type: BlockType, raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = BLOCK_SETTINGS_SCHEMAS[type].safeParse(raw);
  return parsed.success ? (parsed.data as Record<string, unknown>) : { ...defaultSettings(type), ...raw };
}

function SettingsForm({ type, value, onChange, options }: { type: BlockType; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; options: BuilderOptions }) {
  // Values may be incomplete while editing; the server validates with BLOCK_SETTINGS_SCHEMAS before saving.
  const p = <T extends BlockType>() => ({ value: value as BlockSettings<T>, onChange: onChange as (v: BlockSettings<T>) => void, options });
  switch (type) {
    case "hero":
      return <HeroForm {...p<"hero">()} />;
    case "top_stories":
      return <TopStoriesForm {...p<"top_stories">()} />;
    case "trending_topics":
      return <TrendingForm {...p<"trending_topics">()} />;
    case "breaking_news":
      return <BreakingForm {...p<"breaking_news">()} />;
    case "featured_story":
      return <FeaturedStoryForm {...p<"featured_story">()} />;
    case "latest_articles":
    case "article_grid":
    case "editors_picks":
      return <ArticleListForm {...p<"latest_articles">()} />;
    case "category_showcase":
      return <CategoryShowcaseForm {...p<"category_showcase">()} />;
    case "most_read":
      return <MostReadForm {...p<"most_read">()} />;
    case "poll_showcase":
      return <PollShowcaseForm {...p<"poll_showcase">()} />;
    case "community":
      return <CommunityForm {...p<"community">()} />;
    case "regional_news":
      return <RegionalForm {...p<"regional_news">()} />;
    case "newsletter":
      return <NewsletterForm {...p<"newsletter">()} />;
    case "custom_cta":
      return <CustomCtaForm {...p<"custom_cta">()} />;
    case "photo_of_day":
      return <PhotoOfDayForm {...p<"photo_of_day">()} />;
    case "quote_of_day":
      return <QuoteOfDayForm {...p<"quote_of_day">()} />;
    case "news_quiz":
      return <NewsQuizForm {...p<"news_quiz">()} />;
  }
}

function IconAction({ action, id, extra, label, disabled, children }: { action: typeof moveSection; id: string; extra?: Record<string, string>; label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={disabled} aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper hover:border-brand disabled:opacity-30">
        {children}
      </button>
    </ActionForm>
  );
}

export function SectionEditor({ section, options, index, total }: { section: BuilderSection; options: BuilderOptions; index: number; total: number }) {
  const known = isBlockType(section.type);
  const [settings, setSettings] = useState<Record<string, unknown>>(() => (known ? initialSettings(section.type as BlockType, section.settings) : section.settings));
  const label = known ? BLOCK_LABELS[section.type as BlockType] : section.type;

  return (
    <li id={`section-${section.id}`} className={`rounded-xl border bg-paper ${section.isEnabled ? "border-line" : "border-dashed border-line opacity-90"}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="w-7 text-sm font-bold tabular-nums text-muted">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{section.title || label}</p>
          <p className="text-xs text-muted">
            {label}
            {!section.isEnabled && <span className="ml-2 font-semibold text-amber-700">Disabled</span>}
            {section.issues.length > 0 && <span className="ml-2 font-semibold text-accent-700">Settings have errors</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconAction action={moveSection} id={section.id} extra={{ dir: "up" }} label="Move up" disabled={index === 0}>
            <ArrowUp className="h-4 w-4" />
          </IconAction>
          <IconAction action={moveSection} id={section.id} extra={{ dir: "down" }} label="Move down" disabled={index === total - 1}>
            <ArrowDown className="h-4 w-4" />
          </IconAction>
          <ActionForm action={toggleSection}>
            <input type="hidden" name="id" value={section.id} />
            <input type="hidden" name="enable" value={section.isEnabled ? "0" : "1"} />
            <SubmitButton variant="ghost" pendingLabel="…" className="min-h-9 px-3">
              {section.isEnabled ? "Disable" : "Enable"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteSection} confirm={`Remove "${section.title || label}" from the draft?`}>
            <input type="hidden" name="id" value={section.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="min-h-9 px-3 text-accent-700">
              Remove
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
      {section.issues.length > 0 && (
        <ul className="mx-4 mb-3 list-disc rounded-lg bg-red-50 py-2 pl-8 pr-3 text-xs text-accent-700">
          {section.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      <details className="border-t border-line">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-brand">Edit section</summary>
        <ActionForm action={updateSection} className="space-y-4 px-4 pb-4">
          <input type="hidden" name="id" value={section.id} />
          <input type="hidden" name="settings" value={JSON.stringify(settings)} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`t-${section.id}`} className="mb-1.5 block text-sm font-semibold text-ink">
                Section title
              </label>
              <input id={`t-${section.id}`} name="title" defaultValue={section.title ?? ""} maxLength={200} className="field" />
            </div>
            <div>
              <label htmlFor={`d-${section.id}`} className="mb-1.5 block text-sm font-semibold text-ink">
                Description
              </label>
              <input id={`d-${section.id}`} name="description" defaultValue={section.description ?? ""} maxLength={600} className="field" />
            </div>
            <div>
              <label htmlFor={`te-${section.id}`} className="mb-1.5 block text-sm font-semibold text-ink">
                Section title in English
              </label>
              <input id={`te-${section.id}`} name="title_en" defaultValue={section.titleEn ?? ""} maxLength={200} className="field" />
            </div>
            <div>
              <label htmlFor={`de-${section.id}`} className="mb-1.5 block text-sm font-semibold text-ink">
                Description in English
              </label>
              <input id={`de-${section.id}`} name="description_en" defaultValue={section.descriptionEn ?? ""} maxLength={600} className="field" />
            </div>
            <p className="text-xs text-muted md:col-span-2">The English fields are shown when a reader switches the site to English. Leave them empty to use the Filipino text.</p>
          </div>
          {known ? (
            <SettingsForm type={section.type as BlockType} value={settings} onChange={setSettings} options={options} />
          ) : (
            <p className="text-sm text-accent-700">Unknown block type; remove this section.</p>
          )}
          {known && <SubmitButton>Save to draft</SubmitButton>}
        </ActionForm>
      </details>
    </li>
  );
}
