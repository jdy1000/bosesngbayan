# Boses ng Bayan — Design System

Source of truth for the public look: the supplied Boses ng Bayan landing-page reference image. It was supplied in chat and is not committed to the repository; add it as `docs/reference/landing.png` when convenient.

Tokens live in `src/app/globals.css` (`:root` + Tailwind v4 `@theme inline`). Brand colours can be overridden per site from **Studio → Settings → Brand**. The public layout then writes `--brand-primary`, `--brand-navy` and `--brand-accent` on `<html>`, and every derived shade follows through `color-mix()`.

## 1. Reference reconstruction

The reference composition, top to bottom, and how it was rebuilt:

| Reference | Implementation |
| --- | --- |
| White sticky header: logo left, centred nav (Bahay, Mga Balita, Usap Bayan, Mga Paksa, Tungkol), search icon, blue pill CTA "Sumali sa Botohan" | `components/public/site-header.tsx` + `main-nav.tsx`. Items come from the `header` navigation menu in the CMS; the CTA label and link come from Settings (`header_cta`), and leaving them blank hides it. |
| Hero split: left eyebrow, large serif headline with one highlighted word, supporting copy, two CTAs (filled "Bumoto ngayon", outlined "Tingnan ang resulta"), community microcopy; right a large community photo with a floating poll card | `blocks/hero-block.tsx`. Every field is a CMS setting. The ballot count in the microcopy is the real `get_total_ballots()` total, and it is hidden when zero. |
| Row of topic chips ("Trending:" Transportasyon, Edukasyon …) | `TrendingTopicsBlock`, from `trending_topics` rows ordered by the editor. |
| "Mga Balita" section with a short red rule above the heading, then a card grid (image, category badge, headline, excerpt, meta) | `SectionHeading` (`.section-kicker`) + `ArticleCard` variant `grid`. |
| Feature tiles explaining why to join | `CustomCtaBlock` variant `feature_tiles` (icon from a fixed Lucide set, title, text). |
| Wide blue banner "Tayo ang Bayan. Tayo ang Boses." with a photo and CTA | `CustomCtaBlock` variant `banner`. |
| Newsletter strip | `NewsletterBlock` + `newsletter-form.tsx`. |
| Navy footer: brand column, link columns, social icons, legal line | `site-footer.tsx`, built from the `footer_main` and `footer_legal` menus plus settings. |

## 2. Colour

| Token | Value | Use |
| --- | --- | --- |
| `brand` (`--brand-primary`) | `#1d4ed8` cobalt | Primary buttons, links, focus ring, active nav |
| `brand-50/100/200` | mixes with white | Tinted surfaces, badges, hover fills |
| `brand-600/700` | mixes with black | Hover and pressed states, badge text |
| `navy` (`--brand-navy`) | `#0b1f5c` | Headlines, footer, dark bands |
| `accent` (`--brand-accent`) | `#d62828` Philippine red | Section rule, breaking label, the highlighted headline word, pull-quote mark |
| `ink` / `ink-soft` / `muted` | `#0f1b3d` / `#3b4766` / `#5b6785` | Body text, secondary text, metadata |
| `line` | `#dfe5f2` | Borders and dividers |
| `surface` / `surface-2` | `#f4f7fd` / `#eaf0fb` | Cool-grey section backgrounds |
| `paper` | `#ffffff` | Page background |

Measured contrast (WCAG 2.x):

| Pair | Ratio |
| --- | --- |
| white on brand | 6.70:1 |
| white on navy | 15.39:1 |
| white on accent | 5.01:1 |
| ink on white | 16.87:1 |
| ink-soft on white | 9.21:1 |
| muted on white | 5.64:1 |
| muted on surface | 5.26:1 |

All of these pass AA for body text. The placeholder grey `#8a94ad` is 3.03:1, so it is used only for placeholders, never for content.

**Rule:** a custom brand colour set in Studio must keep white text at ≥4.5:1. Settings validation rejects brand and accent colours that fail this against white.

## 3. Typography

- **Display:** Source Serif 4 (600/700/800, italic). Used for headlines, hero, article titles, pull quotes and serif `h2` in article bodies.
- **Text:** Plus Jakarta Sans (400–800). Used for navigation, body, labels, buttons and Studio.
- Both load via `next/font/google` with `display: swap` and `latin-ext` (for ñ and accented names).

Scale in use:

| Role | Size | Line height |
| --- | --- | --- |
| Hero headline | 2.6rem → 3.4rem (sm) → 4rem (lg), tracking −0.015em | 1.04 |
| Article title | 2.2rem → 3rem (md) | 1.1 |
| Section heading | ~1.75–2.25rem, serif | — |
| Article body (`.prose-bnb`) | 1.125rem, h2 1.75rem serif, h3 1.3rem | 1.75 |
| UI body | 16px | 1.55 |
| Metadata | 0.8–0.875rem | — |
| Category badge | 0.72rem uppercase, 800 weight, 0.04em tracking | — |

Headings use `text-wrap: balance`.

## 4. Space, layout, breakpoints

- **Container:** `.container-site`, max 1200px, with side gutters of 16px (<640), 24px (≥640) and 32px (≥1024).
- **Breakpoints:** Tailwind defaults (sm 640, md 768, lg 1024, xl 1280). Layouts are recomposed rather than shrunk:
  - hero stacks copy above the photo below `lg`, and the poll card drops under the photo on phones;
  - the nav collapses to a full-height panel below `lg`;
  - card grids go 3 → 2 → 1;
  - the article page aside moves below the body.
- **Section rhythm:** `py-14`–`py-20`, alternating `paper` and `surface` bands. Only one dense band at a time.
- **Touch targets:** buttons, chips and fields are ≥44px tall (chips 32px with padded hit area in lists).

## 5. Components

| Component | Spec |
| --- | --- |
| `.btn-primary` | Brand fill, white text, pill, 44px min, hover darkens to `brand-600`, 1px press |
| `.btn-outline` | White fill with a brand-200 inset ring; ring turns brand on hover |
| `.btn-light` | White on dark bands |
| Disabled | `aria-disabled` or `disabled`, 55% opacity, not-allowed cursor, plus a visible reason next to it |
| `.chip` | Topic link, white pill with a line ring |
| `.category-badge` | Tinted brand pill, uppercase |
| `.card` | White, 14px radius, two-layer soft shadow (`--shadow-card`) |
| `.field` | 44px, 12px radius, inset ring, 2px brand ring on focus |
| Focus | 3px brand outline, 2px offset, on every interactive element (`:focus-visible`) |
| `ArticleCard` variants | `grid` (16:10 image), `list` (thumbnail row), `feature` (large lead), `compact` (text only) |
| Poll card | Radio for single choice or checkbox for multiple; result bars appear after voting when visibility allows; "hindi kumakatawan sa buong populasyon ng Pilipinas" caveat and a methodology link |
| Section heading | `.section-kicker`: 36×4px red rule above the title, optional "see all" action link |

**Studio** uses the same tokens and fonts in a denser layout (`components/studio/ui.tsx`): PageHeader, Panel, Table, Badge tones (neutral, info, success, warning, danger), StatusBadge for article states, Notice, Empty, Pagination and Field. There are no gradients or decorative imagery.

## 6. States

Every data view renders:

- **loading:** server-rendered, so there are no spinners on first paint; client forms show pending text on the submit button;
- **empty:** `EmptyState` / `Empty`, with a plain sentence and the next action;
- **error:** the route `error.tsx` boundary with a retry button, and inline `Notice` messages in forms;
- **success:** inline confirmation text announced through `role="status"`.

Blocks that depend on data that does not exist yet are hidden rather than shown with fake numbers: Most Read without page views, Breaking without breaking stories, and the hero count at zero.

## 7. Imagery

| Use | Aspect |
| --- | --- |
| Hero photo | 5:4.4 on desktop, 4:3 on phones |
| Cards | 16:10 |
| Article lead | 16:9 |
| Banner | 21:9 |
| Regional | 16:11 |

- Images use `next/image` with `sizes` set per slot.
- Alt text comes from the media library and editors are warned when it is missing; credit and caption render under figures.
- When no image exists, a brand gradient with the category name stands in. Stock "fake product" shots are never substituted.
- Development photographs in `supabase/seed-media/` carry licences and credits in `CREDITS.json`.

## 8. Motion

Motion is limited to colour, shadow and 1px transforms (150ms). `prefers-reduced-motion` removes transitions. There are no scroll-jacking or autoplay animations.
