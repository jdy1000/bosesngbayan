# Boses ng Bayan — Design System

Source of truth for the public look: the supplied Boses ng Bayan landing-page reference image. It was supplied in chat and is not committed to the repository; add it as `docs/reference/landing.png` when convenient.

Tokens live in `src/app/globals.css` (`:root` + Tailwind v4 `@theme inline`). Brand colours can be overridden per site from **Studio → Settings → Brand**. The public layout then writes `--brand-primary`, `--brand-navy` and `--brand-accent` on `<html>`, and every derived shade follows through `color-mix()`.

## 1. Reference reconstruction

**2026-11-06 redesign (ADR-012).** The owner asked for a news site that looks like the Morning template (https://morning-template.webflow.io) and Istorya (https://istorya.news), instead of the original poll-led landing reference. Morning supplies the visual language: a white editorial grid, ruled section heads, square controls and small-caps category labels. Istorya supplies the structure: dateline with trending chips, regional discovery and daily modules. Brand colours are unchanged.

Starter homepage, top to bottom (all CMS blocks; since ADR-017 the order can no longer be changed from Studio):

| Section | Implementation |
| --- | --- |
| Navy masthead, two rows on desktop: wordmark + search + red "Mag-subscribe" CTA, then the category row (uppercase, 3px accent underline on the active item, scrolls sideways if the CMS menu outgrows the width). Phones: one row + hamburger panel. | `site-header.tsx`, `main-nav.tsx` (`MainNav`, `DesktopNav`); items from the `header` menu, CTA from Settings `header_cta`. Nav styles live in `globals.css` (`.nav-link`). |
| Dateline (Asia/Manila) + #trending chips | `TrendingTopicsBlock`. |
| Breaking strip (only when a breaking story exists) | `BreakingNewsBlock`. |
| Top stories: the lead is a cover story (full-bleed photo, dark scrim, serif headline; owner reference 2026-11-09) that shares row 1 with the right rail's top card, so the two end on the same line (416px tall from `lg`; the rail card's photo stretches to fill, `ArticleCard` prop `fill`); the 3-story row sits directly under the cover and the rail's compact list beside it, on the shared row 2 | `TopStoriesBlock`, `CoverStory` (`components/public/cover-story.tsx`), `ArticleCard` variants `grid`, `compact`. The `feature` variant (text beside image) is still used by the category page lead and the featured-story block. |
| "Pinakabagong Balita" list with a sticky sidebar: ranked "Trending" when tracked views exist, otherwise a "Mga Paksa" section index; then the latest approved Usap Bayan posts | `ArticleListBlock` layout `list`, `with_sidebar`. |
| "Pili ng Editor" two-column headline-left/thumb-right list | `ArticleListBlock` layout `side`. |
| Newsletter card (red top rule) | `NewsletterBlock`. |
| "Mga Seksyon": three category columns | `CategoryShowcaseBlock`. |
| "Balitang Rehiyon": Luzon / Visayas / Mindanao with region chips and stories | `RegionalNewsBlock`. |
| "Botohan ng Araw": ballot (7 cols) beside a panel with the counting rules and other open/closed polls | `PollShowcaseBlock`. |
| Navy footer | `site-footer.tsx`. |

The original poll hero (`blocks/hero-block.tsx`) remains available as the `hero` block.

## 2. Colour

| Token | Value | Use |
| --- | --- | --- |
| `brand` (`--brand-primary`) | `#1d4ed8` cobalt | Primary buttons, links, focus ring, active nav |
| `brand-50/100/200` | mixes toward the page (`--tint-base`: white, or black in dark mode) | Tinted surfaces, badges, hover fills |
| `brand-600/700/800` | mixes away from the page (`--shade-base`: black, or white in dark mode) | Hover and pressed states, badge text |
| `navy` (`--brand-navy`) | `#0b1f5c` | Headlines, footer, dark bands |
| `accent` (`--brand-accent`) | `#d62828` Philippine red | Section rule tab, breaking label, the highlighted headline word, pull-quote mark |
| `sun` | `#fcd116` the flag's sun | Kicker text and "open" labels on the brand-coloured community band only. 5.0:1 on the default cobalt. Never on white, never as a fill behind text. |
| `ink` / `ink-soft` / `muted` | `#121418` / `#3f4550` / `#5f6672` | Body text, secondary text, metadata |
| `line` | `#e4e6ea` | Borders and dividers |
| `surface` / `surface-2` | `#f7f7f8` / `#eeeff2` | Section backgrounds |
| `paper` | `#ffffff` | Page background, cards, fields (`bg-paper`, never `bg-white`) |

Measured contrast (WCAG 2.x):

| Pair | Ratio |
| --- | --- |
| white on brand | 6.70:1 |
| white on navy | 15.39:1 |
| white on accent | 5.01:1 |
| ink on white | 18.44:1 |
| ink-soft on white | 9.64:1 |
| muted on white | 5.78:1 |
| muted on surface | 5.40:1 |

All of these pass AA for body text. The placeholder grey `#8a94ad` is 3.03:1, so it is used only for placeholders, never for content.

### Dark mode

Light is the default. A reader can switch to dark with the sun/moon button on the public site. The Studio has no toggle of its own (ADR-016) and follows the same choice. The choice is stored in the `bnb_theme` cookie, and the server writes `<html data-theme>` so the first paint already uses the right theme. The neutral roles are CSS variables on `:root`, redefined under `:root[data-theme="dark"]`:

| Role | Dark value | Contrast |
| --- | --- | --- |
| `paper` | `#000000` (true black) | |
| `surface` / `surface-2` | `#0e0e10` / `#19191c` | |
| `line` | `#2a2a2e` | |
| `ink` | `#f2f2f3` | 18.77:1 on paper |
| `ink-soft` | `#c9c9cd` | 12.72:1 on paper |
| `muted` | `#9d9da4` | 7.79:1 on paper, 6.51:1 on surface-2 |
| chart second series | `#9db0ea` | 9.83:1 on paper |

Rules:
- Use the role tokens (`bg-paper`, `text-ink`, `border-line` and so on). `bg-white` is kept only where the surface stays white in both themes: the Breaking label on the red strip, the pressed FIL/EN pill on navy, and `.btn-light` on navy.
- The navy public header and footer stay navy in both themes as brand chrome. The Studio sidebar is `bg-paper`, so it follows the theme.
- In dark mode, `text-brand`, article links, `text-navy` headings and `text-accent-700` error text switch to lighter equivalents (see the end of `globals.css`), because the light-mode colours fall below 4.5:1 on black. The Tailwind status tints (`red-50`, `emerald-50/700/800`, `amber-50/700/800/900` and their `-200` borders) point to dark equivalents.

**Rule:** a custom brand colour set in Studio must keep white text at ≥4.5:1. Settings validation rejects brand and accent colours that fail this against white.

## 3. Typography

- **One family: Inter** (variable), via `next/font/google`, `display: swap`, preloading the `latin` subset only (covers Filipino incl. ñ; latin-ext loads on demand). `--font-serif` maps to the same family.
- Hierarchy comes from size and weight, not from a second face. Headlines are **bold 700** with slight negative tracking (−0.01 to −0.025em); small card titles stay semibold 600. (Polish pass 2026-11-09: card and section headlines were medium/semibold and read too evenly.)
- **One exception, by owner request (2026-11-09):** the cover story headline on the homepage is set in **Lora** (variable, Latin subset), declared in `components/public/display-font.ts` so Next preloads it only on routes that render the cover. Nothing else uses it. Everything else stays Inter.

| Role | Size | Line height |
| --- | --- | --- |
| Lead story headline (`feature` variant) | 1.85rem → 2.2rem (md), bold, tracking −0.02em | 1.12 |
| Community band title | 2.25rem → 3rem (md), bold, tracking −0.025em | 1.05 |
| Article title | 2rem → 2.75rem (md), semibold, tracking −0.02em | 1.12 |
| Section heading | 1.75rem → 2.15rem, bold, inside `.section-rule` | 1.25 |
| Column / sidebar heading | 1.25rem, bold | snug |
| Card headline | `grid` 0.95rem semibold → 1.15rem bold (sm); `list` 1rem → 1.45rem bold; `side` 1.08 → 1.2rem bold; `compact` 0.95rem semibold | 1.25 |
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
| `.btn-primary` | Brand fill, white text, 4px radius, semibold, 44px min, hover darkens to `brand-600`, presses to `scale(0.97)` (not when disabled) |
| `.btn-outline` | White fill with a brand-200 inset ring; ring turns brand on hover |
| `.btn-light` | White on dark bands |
| Disabled | `aria-disabled` or `disabled`, 55% opacity, not-allowed cursor, plus a visible reason next to it |
| `.chip` | Topic link, white pill with a line ring |
| `.category-badge` | Plain uppercase brand-700 label; `.bg-accent` variant is a red tile (Breaking) |
| `.card` | White, 6px radius, 1px inset line border, no heavy shadow |
| `.field` | 44px, 4px radius, inset ring, 2px brand ring on focus |
| Focus | 3px brand outline, 2px offset, on every interactive element (`:focus-visible`) |
| `CoverStory` | Homepage lead. Min height 30rem (34rem from `sm`); from `lg` the minimum is 26rem (416px) and the row is shared with the rail's top card, whose photo grows to end on the same line; the deck is hidden at `lg` (headline 2.2rem, three lines at 1280 and up). Photo fills the card; scrim `linear-gradient(to top, black 90% → 74% at 45% → 30% at 72% → 0)`. Over it, in white: a spaced uppercase kicker ("Pangunahing balita / Category"; phones show only the category), a Lora semibold headline (1.9rem → 2.6rem), a two-line deck, then an underlined "Basahin ang kuwento ↗" with the reading time. The whole card is one link; hover zooms the photo 2%. White text in both themes. No image: navy field. |
| `ArticleCard` variants | `grid` (16:10 image over headline), `list` (thumb left, excerpt), `feature` (lead: text beside 4:3 image), `compact` (small thumb left), `side` (headline left, thumb right) |
| Poll card | Radio for single choice or checkbox for multiple; result bars appear after voting when visibility allows; "hindi kumakatawan sa buong populasyon ng Pilipinas" caveat and a methodology link |
| Section heading | `.section-rule`: 3px ink rule above with a 72px red tab at its left end, hairline below, optional "label →" action link. Page headers still use `.section-kicker`. |
| Community band (`PollShowcaseBlock`) | The page's one loud moment: full-bleed `bg-brand`, white text in both themes. Left: a kicker (2px sun rule + uppercase "Boses ng Bayan"), a 3rem bold title, a one-line pitch, a white "Ibahagi ang iyong boses" button and an underlined "Lahat ng botohan →", then the counting note and other polls under a hairline. Right: the ballot, the only white (black in dark mode) object, lifted with a soft shadow. Phones stack intro → ballot → details. A band that ends the page carries `data-flush-footer` and the footer drops its top margin, so no white strip separates them. |
| Newsletter band | Full-bleed `bg-brand-50`, no card: red-rule kicker, 2.5rem bold title, form beside it. |
| Community picks (sidebar) | Each approved Usap Bayan post is a `bg-brand-50` card: red kind label, semibold title, an initial-in-a-circle avatar with name and place. The "Ibahagi ang iyong boses" button is a primary button. |

**Studio** uses the same tokens and fonts in a denser layout (`components/studio/ui.tsx`): PageHeader (with an optional `eyebrow`), Panel, Table, Badge tones (neutral, info, success, warning, danger), StatusBadge for article states, Notice, Empty, Pagination and Field. There are no gradients or decorative imagery.

The Studio shell follows the Newsmaker console (ADR-016):
- *Sidebar.* `bg-paper` with a right hairline. The brand block reads "Studio / Editorial workspace". Below it is one flat list under a small uppercase "PUBLICATION" label, with no groups. The active item uses `bg-surface-2` with `text-brand-700`. Only the list scrolls. The pinned footer holds "Private workspace / Authorized editors only", "View publication" (opens the public site in a new tab) and "Sign out". Below `lg` the sidebar becomes a drawer behind a menu button; it closes on Escape and after navigation.
- *Top bar.* A "Workspace / <page>" breadcrumb, article search with a ↵ submit button from `md` up, and an identity chip (initial, name, role) that links to My account. There is no notification bell and no theme toggle.
- *Page header.* An optional `eyebrow`: a single small uppercase brand kicker such as "Content" or "Editorial workflow", above an h1 and a description. The kickers per page are listed in ADR-016. When a page has a breadcrumb, the breadcrumb replaces the eyebrow.
- *List pages.* One `rounded-2xl` card holds the tabs, a filter row, a `Table plain`, and the `Pagination` footer, which reads "a–b of N items" and hides itself when the list is empty.
- *Editor.* A form column, with a right column that starts with the Publishing card. Its full-width actions are ordered primary first, then outline.
- *Footer.* A slim row: "Boses ng Bayan" and "Editorial workspace · <year>".
- *Media picker* (`components/studio/media-picker.tsx`). A thumbnail with "Choose image" / "Change" and "Remove". "Choose image" opens a modal `<dialog>` with:
  - a search field over existing images;
  - an "Upload a new image" area on a `surface` band: file input (JPEG, PNG, WebP, GIF or AVIF, up to 4 MB), alt text (required, up to 300 characters), caption and credit (optional, up to 600 and 200), and an "Upload and use" button. Errors show inline with `role="alert"`, and the new image is selected straight away;
  - a grid of existing images, each flagged "No alt text" when it has none.

  The inputs are plain fields with a click handler rather than a form, because the picker usually sits inside another form.

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
- Alt text comes from the media record. New uploads require it in the picker, and the picker flags existing images without it. Credit and caption render under figures.
- When no image exists, a brand gradient with the category name stands in. Stock "fake product" shots are never substituted.
- Development photographs in `supabase/seed-media/` carry licences and credits in `CREDITS.json`. Every preview photo is CC0, public domain or Unsplash License (no attribution required), so no credit line is shown; a photo with `credit_required: true` would get one. Story photos (`ph-*.jpg`) are real Philippine scenes matched to each preview story; captions describe only what is in the photo and never name real places or people (ADR-013). Photos are never copied from other publishers' articles (copyright).
- Story meta (category · author · time · reading time) wraps flush left: each item carries its separator in a clipped gutter. Phones hide reading time; grid cards show time only so rows line up.
- Below `sm`, `grid` and `list` cards become thumbnail rows (112px, 4:3) to keep long pages scannable; the lead story keeps its full image.

## 8. Motion

Motion is limited to colour, shadow, the `scale(0.97)` button press and the slow thumbnail zoom on card hover (150ms; 500ms for the zoom). `prefers-reduced-motion` removes transitions. There are no scroll-jacking or autoplay animations.

## 9. Detail rules (2026-11-09 polish pass)

- **Corner radii.** Controls, poll options, notices and thumbnails use 4px (`rounded`); cards, panels and prose images use 6px (`--radius-card`). An inner element is never rounder than the surface that holds it.
- **Image edges.** Content photographs carry a 1px pure-black outline at 10% (pure white at 10% in dark mode) through `.img-frame` (card thumbnails, the article lead photo) and `.prose-bnb img`. The outline sits inside the image (`outline-offset: -1px`).
- **Focus ring.** The 3px outline follows each element's own radius. Do not set `border-radius` on `:focus-visible`.
- **Text wrapping.** Headings use `text-wrap: balance`; paragraphs, list items and captions use `text-wrap: pretty`.
- **Top-ruled panels.** A panel with a heavy top rule and rounded corners draws the rule with an inset shadow (`shadow-[inset_0_3px_0_var(--color-ink)]`), not `border-top`, so the corners do not taper.
- **Short rows.** A row that cannot fill its grid must not leave an empty column. Poll lists size their columns to the count (1, 2, 3 or more); the Usap Bayan featured banner goes full width when there is only one; related stories use one list row, two columns, or three columns.
- **Paired cards.** Cards that share a row line their options and actions up from the bottom (`mt-auto`), so a longer question does not push one card's button lower than its neighbour's.
- **Narrow fields.** A newsletter form stacks its field and button unless its own container is at least 24rem wide (container query), so the placeholder is never clipped in the footer column.
- **Scrolling chip rows.** The trending row fades out at its right edge, so a chip cut off by the row reads as "more to scroll".
