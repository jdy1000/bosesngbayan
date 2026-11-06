# Boses ng Bayan — Design System

Source of truth for the public look: the supplied Boses ng Bayan landing-page reference image. It was supplied in chat and is not committed to the repository; add it as `docs/reference/landing.png` when convenient.

Tokens live in `src/app/globals.css` (`:root` + Tailwind v4 `@theme inline`). Brand colours can be overridden per site from **Studio → Settings → Brand**. The public layout then writes `--brand-primary`, `--brand-navy` and `--brand-accent` on `<html>`, and every derived shade follows through `color-mix()`.

## 1. Reference reconstruction

**2026-11-06 redesign (ADR-012).** The owner asked for a news site that looks like the Morning template (https://morning-template.webflow.io) and Istorya (https://istorya.news), instead of the original poll-led landing reference. Morning supplies the visual language: a white editorial grid, ruled section heads, square controls and small-caps category labels. Istorya supplies the structure: dateline with trending chips, regional discovery and daily modules. Brand colours are unchanged.

Starter homepage, top to bottom (all CMS blocks, reorderable in Studio):

| Section | Implementation |
| --- | --- |
| Navy masthead: wordmark, category nav (uppercase, accent underline on the active item), search, red "Mag-subscribe" CTA | `site-header.tsx` + `main-nav.tsx`; items from the `header` menu, CTA from Settings `header_cta`. |
| Dateline (Asia/Manila) + #trending chips | `TrendingTopicsBlock`. |
| Breaking strip (only when a breaking story exists) | `BreakingNewsBlock`. |
| Top stories: lead story (text beside a 4:3 image) with a 3-story row below and a right rail (one card plus compact items) | `TopStoriesBlock`, `ArticleCard` variants `feature`, `grid`, `compact`. |
| "Pinakabagong Balita" list with optional ranked "Trending" sidebar | `ArticleListBlock` layout `list`, `with_sidebar`. |
| "Pili ng Editor" two-column headline-left/thumb-right list | `ArticleListBlock` layout `side`. |
| Newsletter card (red top rule) | `NewsletterBlock`. |
| "Mga Seksyon": three category columns | `CategoryShowcaseBlock`. |
| "Balitang Rehiyon": Luzon / Visayas / Mindanao with region chips and stories | `RegionalNewsBlock`. |
| "Botohan ng Araw" poll module with methodology caveat | `PollShowcaseBlock`. |
| Navy footer | `site-footer.tsx`. |

The original poll hero (`blocks/hero-block.tsx`) remains available as the `hero` block.

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

- **One family: Inter** (variable), via `next/font/google`, `display: swap`, preloading the `latin` subset only (covers Filipino incl. ñ; latin-ext loads on demand). `--font-serif` maps to the same family.
- Hierarchy comes from size and weight (semibold 600 for headlines, medium 500 for card titles), not from a second face.

| Role | Size | Line height |
| --- | --- | --- |
| Lead story headline | 1.75rem → 2.25rem (md), semibold, tracking −0.015em | 1.15 |
| Article title | 2rem → 2.75rem (md), semibold, tracking −0.02em | 1.12 |
| Section heading | 1.6rem → 1.9rem, semibold, inside `.section-rule` | 1.25 |
| Card headline | 0.92–1.3rem, medium | snug |
| Article body (`.prose-bnb`) | 1.125rem | 1.75 |
| Metadata | 0.78rem, hairline dividers | — |
| Category label | 0.72rem uppercase, brand-700 text (red tile for Breaking) | — |

Headings use `text-wrap: balance`.

## 4. Space, layout, breakpoints

- **Container:** `.container-site`, max 1240px, with side gutters of 16px (<640), 24px (≥640) and 32px (≥1024).
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
| `.btn-primary` | Brand fill, white text, 4px radius, semibold, 44px min, hover darkens to `brand-600`, 1px press |
| `.btn-outline` | White fill with a brand-200 inset ring; ring turns brand on hover |
| `.btn-light` | White on dark bands |
| Disabled | `aria-disabled` or `disabled`, 55% opacity, not-allowed cursor, plus a visible reason next to it |
| `.chip` | Topic link, white pill with a line ring |
| `.category-badge` | Plain uppercase brand-700 label; `.bg-accent` variant is a red tile (Breaking) |
| `.card` | White, 6px radius, 1px inset line border, no heavy shadow |
| `.field` | 44px, 4px radius, inset ring, 2px brand ring on focus |
| Focus | 3px brand outline, 2px offset, on every interactive element (`:focus-visible`) |
| `ArticleCard` variants | `grid` (16:10 image over headline), `list` (thumb left, excerpt), `feature` (lead: text beside 4:3 image), `compact` (small thumb left), `side` (headline left, thumb right) |
| Poll card | Radio for single choice or checkbox for multiple; result bars appear after voting when visibility allows; "hindi kumakatawan sa buong populasyon ng Pilipinas" caveat and a methodology link |
| Section heading | `.section-rule`: 3px ink rule above, hairline below, optional "label →" action link. Page headers still use `.section-kicker`. |

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
