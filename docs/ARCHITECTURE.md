# Boses ng Bayan — Architecture

This document describes the system as it is built. The product requirements are in
`docs/BOSES_NG_BAYAN_MASTER_SPEC.md`. Current status is tracked in `progress.txt`.

## 1. Stack (actual versions, `package.json`)

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16.4.5 (App Router, Turbopack), React 19.3, TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens in `src/app/globals.css`), Lucide icons |
| Database / Auth / Storage | Supabase (PostgreSQL 15+, Supabase Auth, Supabase Storage) via `@supabase/supabase-js` 2.119 and `@supabase/ssr` 0.12.7 |
| Rich text | TipTap 3.33 (editor in Studio; `@tiptap/html/server` renders JSON → HTML on save) + `sanitize-html` 2.18 |
| Validation | Zod 4.6 at every trust boundary (route handlers, server actions, block settings) |
| Charts | Recharts 3.10 (Studio analytics only) |
| Tests | Vitest 5.1 (unit + PGlite database tests), Playwright 1.65 (e2e, needs a running stack) |
| Package manager | pnpm 11.13 (`pnpm-workspace.yaml` allows the esbuild build script) |

No other runtime services are required. An email provider is optional (see §7).

## 2. Repository layout

```
src/
  app/
    (site)/            public website (route group, force-dynamic)
    admin/             Boses ng Bayan Studio
      login/, auth/    sign-in, password recovery, invitation callback
      (studio)/        protected console (layout calls requireStaffPage)
      apply/           public "apply for newsroom access" form, reachable signed out (ADR-018)
      preview/         protected draft preview (articles)
      api/             staff-only JSON helpers (media picker)
    api/public/v1/     public JSON API (reads + rate-limited writes)
    api/cron/          scheduled jobs (Bearer CRON_SECRET)
    sitemap.ts, robots.ts, rss.xml/
  components/
    public/            public site components; public/blocks/ = homepage block renderers
    studio/            Studio shell, UI kit, ActionForm, media picker, rich-text editor
  lib/
    supabase/server.ts three clients (see §3)
    auth/              session + permission guards
    cms/               public read layer (published content only)
    studio/            Studio data helpers (dashboards, ranges, CSV, reorder, media upload, ads, applications, invitations …)
    homepage/blocks.ts typed, Zod-validated homepage block schema (17 block types)
    rich-text/         TipTap extensions, render + sanitize
    security/          hashing, rate limiting, same-origin check, cron auth
    database.types.ts  generated from the migrations (`pnpm db:types`)
  proxy.ts             Next 16 "proxy" (formerly middleware): session refresh + /admin gate
supabase/
  migrations/          version-controlled schema, RLS, RPCs, storage policies
  seed.sql             roles/permissions matrix, seed categories/topics/menus/pages/homepage
  seed-media/          licensed demo photographs + CREDITS.json (development only)
scripts/
  gen-db-types.ts      types generator (runs the migrations in PGlite)
  bootstrap-owner.ts   one-time Owner creation
  seed-demo.ts         preview content; local by default (ADR-013, ADR-019)
tests/
  unit/                pure logic
  db/                  migrations + RLS + RPC behaviour in PGlite
```

## 3. Data-access boundaries

`src/lib/supabase/server.ts` exposes exactly three clients. All are server-only (`import "server-only"`).

1. **Session client** (`createSessionClient`). Used by Studio pages, server actions and previews. It runs as the signed-in user, so every query is filtered by RLS. Studio never needs the service role for content work.
2. **Public client** (anon key, no cookies). Used by `src/lib/cms/*` for public reads. RLS only exposes published, public rows, for example through `article_is_public(status, published_at)`.
3. **Service client** (service-role key). Used only for:
   - narrow public-write RPCs (votes, comments, submissions, reports, newsletter, page views, publisher applications), called after the route handler has validated, rate-limited and checked origin;
   - scheduled jobs;
   - Supabase Auth admin calls (team and application invitations, deactivation).

   It is never imported by client components, and the key is never prefixed `NEXT_PUBLIC_`.

Authorization is always enforced twice:
- in the server action or route, with `requirePermission` / `requireStaffPage` in `src/lib/auth`;
- in the database, with RLS policies and `has_permission()` checks inside SECURITY DEFINER RPCs.

Hidden sidebar items are only a convenience.

## 4. Request flows

- **Public page**: `(site)` server component → `lib/cms` → public client → RLS → render. No client-side data fetching except the poll card, newsletter, comments, reports and submissions, which POST to `/api/public/v1/*`.
- **Public write**: route handler. Each one, in order:
  1. checks same origin (`isSameOrigin`);
  2. validates the JSON body with Zod (plus a honeypot `website` field);
  3. applies a database-backed rate limit (`check_rate_limit`) keyed by a hashed network identifier;
  4. calls a service RPC that re-validates and writes;
  5. returns a uniform, safe error envelope.
- **Studio mutation**: `"use server"` action → `requirePermission(perm)` → Zod parse → session client (RLS) or a SECURITY DEFINER RPC that checks `has_permission()` → `revalidatePath` → `FormActionResult` back to `ActionForm`.
- **Editorial transition**: `transition_article(article_id, to, note)` RPC. It validates the state machine and permissions and records reviewer/approver/publisher and timestamps (see `EDITORIAL_WORKFLOW.md`).
- **Preview**: `/admin/preview/articles/[id]`, the only preview route since ADR-017. It requires a staff session, reads drafts through the session client, and sends `noindex` and `no-store`. Public endpoints never return drafts.

## 5. Architecture decision records

**ADR-001 — Supabase for database, auth and storage.** The repository was new, and the spec's default fits. One vendor covers Postgres + RLS, Auth (invitations, recovery, PKCE), and Storage with policies. It has a free tier for staging.

**ADR-002 — Local-only development until account turnover.** The client's GitHub, Vercel and Supabase accounts are not yet available. Nothing is provisioned remotely, and no repository or project is created. Everything runs against `supabase start` (Docker) or PGlite tests. Deployment steps are documented in `docs/DEPLOYMENT.md`. *(Superseded 2026-11-12: the accounts are available and the site is deployed. GitHub `jdy1000/bosesngbayan`, Vercel team `jdy2`, Supabase project `civmfyqegywwiofhqcya`. See the status line in `docs/DEPLOYMENT.md`.)*

**ADR-003 — Security in the database, not only in the app.** Every table has RLS enabled. Writes that must be atomic or need elevated rights are SECURITY DEFINER functions with explicit `has_permission()` checks and a pinned `search_path = public`. Examples: transitions, votes, homepage publish, role changes, audit writes. `is_service_context()` recognises service-role calls (JWT role, or `session_user` for migrations and tests) so that only server code can call service-only RPCs.

**ADR-004 — Dynamic rendering, no component cache.** `cacheComponents: false`, and the root layout (plus the `(site)` and Studio layouts) use `export const dynamic = "force-dynamic"`. This also lets the per-request CSP nonce from `src/proxy.ts` reach every page.
- Why: CMS changes must appear immediately, previews must never be cached, and `next build` must not need a live database.
- Public JSON reads send `s-maxage=60, stale-while-revalidate=300`.
- Studio actions call `revalidatePath` after publishing changes, so cached responses update when that behaviour is enabled later.
- Upgrade path: enable `cacheComponents` with tag-based invalidation once traffic justifies it.

**ADR-005 — Database tests in PGlite.** Docker Desktop was unavailable on the build machine, so the Supabase HTTP stack (PostgREST, GoTrue, Storage) could not run. `tests/db` instead loads every migration into PGlite, with stub `auth` and `storage` schemas, and exercises RLS by switching roles and JWT claims. It covers 49+ cases: workflow transitions, vote integrity, rate limits, moderation, newsletter and homepage publishing. Playwright e2e runs once a stack is available.

**ADR-006 — Generated types with nullable RPC arguments.** `scripts/gen-db-types.ts` applies the migrations in PGlite and emits `database.types.ts`. Every RPC argument is typed `T | null`. Omitting a key makes PostgREST resolve a different function signature, which fails at runtime, so callers must pass `null` explicitly.

**ADR-007 — Public media bucket.** Published imagery must be CDN-servable, so the `media` bucket is public-read.
- Storage policies allow uploads only with `media.upload`, and only into the uploader's own `<uid>/` folder.
- Replace or delete requires owning the object, or `media.manage_any`.
- Uploads are magic-byte sniffed (`sniffMime`); SVG is rejected and size is capped at 4 MB, because uploads pass through a server action and Vercel limits request bodies to 4.5 MB. For larger files, switch to signed direct-to-storage uploads.
- Do not upload private documents here.
- Since ADR-017 the Studio uploads images only through the media picker (`uploadImage`, ADR-016). No Studio screen edits, replaces or deletes existing media. The storage policies above are unchanged.

**ADR-008 — Scheduled publishing without minute-level cron.** An article in `scheduled` status becomes publicly visible as soon as `published_at <= now()`, through `article_is_public(status, published_at)`. Visibility therefore does not depend on a job running.
- `/api/cron/publish` calls `publish_due_articles()` and then revalidates; it only flips the stored status to `published`.
- `vercel.json` runs it daily, which is Vercel Hobby-compatible.
- For more frequent status flips, use Vercel Pro cron or Supabase `pg_cron` calling the same function.

**ADR-009 — Privacy-preserving analytics and voting.**
- Raw IPs, user agents and voter tokens are never stored. Only `HMAC-SHA256(HASH_SECRET, scope:value)` hashes are kept.
- Visitor hashes rotate every Manila calendar day.
- Likely bots are dropped before insert.
- `purge_old_analytics()` (daily cron) enforces retention.
- Raw page-view events are kept for 13 months.
- Anonymous polls deduplicate by an httpOnly voter-token cookie (hashed server-side) plus a per-network rate limit (20 vote requests per 10 minutes). This deters casual repeat voting but cannot stop a determined actor; the public methodology section on /botohan explains the one-vote-per-browser rule and that online polls are not representative.

**ADR-010 — Typed homepage blocks.** Homepage sections are relational rows (`homepage_sections`) with JSON `settings` validated by per-type Zod schemas in `src/lib/homepage/blocks.ts`.
- Draft and published configurations are separate rows. `publish_homepage()` copies the draft atomically.
- Invalid or unknown blocks are skipped at render time rather than breaking the page.
- Since ADR-017 the homepage builder is gone from Studio. The public site still renders the stored published configuration. The tables and RPCs are unchanged.

**ADR-011 — Redirects.** The `redirects` table drives `redirectOrNotFound()` on 404s, with 301/308 treated as permanent. Table CHECKs require the destination to be a same-site path or an https URL, different from the source. `hit_count` exists in the schema but is not incremented yet, which would require a service write on every redirect.
- Since ADR-017 there is no Studio screen for redirects. Loop detection lived in `lib/studio/redirects.ts`, which was deleted with the SEO module, so a redirect added with SQL is not checked for loops.

**ADR-012 — News-first homepage (2026-11-06).** At the owner's request the public site was redesigned as a news site after the Morning template (visual language) and Istorya (structure); the poll-led hero is no longer the default.
- New block type `top_stories` (migration `20261106001000_top_stories_block.sql`, schema in `lib/homepage/blocks.ts`): lead from featured, latest or a manual pick, plus rail and below-row counts. Its lead image is the only preloaded image on the homepage.
- `latest_articles` gained `with_sidebar`, which shows a ranked most-read list only when tracked views exist.
- Inter is the single font family; `--font-serif` maps to it so legacy classes stay harmless.
- The `hero` block type remains in the schema and the renderer. Since ADR-017 the homepage layout can no longer be changed from Studio.

**ADR-013 — Unlabelled local preview content (2026-11-06).** The owner asked for the local site to read as a real publication, with no "[Demo]" labels, disclaimers or photo credits. The spec (section 0) asks for clearly labelled demo content, so the following safeguards replace the visible labels:
- `pnpm seed:demo` refuses any non-local Supabase URL, so this content cannot reach production. *(Changed 2026-11-12: the content was loaded into the production project on request, behind an explicit opt-in. See ADR-019.)*
- Content is generic: no real people, quotes, statistics, named institutions or events; bylines are newsroom desks (`Editorial Desk`, `Boses ng Bayan Newsroom`); polls start with zero votes.
- Photos are CC0, public domain or Unsplash License only (no attribution required); provenance stays in `supabase/seed-media/CREDITS.json`. CC BY / BY-SA photos were removed because they legally require a visible credit.
- Before launch, the newsroom replaces all preview content with real reporting (a fresh production database never runs the seed).

**ADR-014 — Studio shell follows the RapidPoll console (2026-11-06).** At the owner's request the Studio uses the same console layout as the team's RapidPoll admin: fixed navy sidebar grouped Pangkalahatan / Nilalaman / Homepage at Site / Komunidad / Administrasyon / Ikaw, a white top bar with article search, a notification bell (pending review, moderation queues) and a user menu (Aking Account, view site, logout), and rounded-2xl panels with a soft card shadow. Boses colours, logo and Filipino labels are kept. The signed-out screens (login, forgot password, new password) share `AuthShell`. *Superseded: the Filipino labels by ADR-015, and the sidebar, bell and user menu by ADR-016.*

**ADR-015: English Studio, Filipino/English public site, light/dark themes (2026-11-06).** The owner asked for:
- an English Studio,
- a public site that is Filipino by default and can switch to English,
- light mode by default, with a black dark mode,
- the logo as the favicon.

This supersedes the Filipino Studio labels in ADR-014.
- *Language.*
  - `src/lib/i18n/` holds typed message catalogues per namespace. `fil` is the source, and `en` must have every key (its type enforces this).
  - Server components call `getI18n()`. Client components use `useI18n()` from the `I18nProvider` in the site layout.
  - The reader's choice is stored in the `bnb_lang` cookie. Without it, the site uses Site Settings → General → Language (default `fil`).
  - The proxy tags each request as `site` or `studio`. Studio always renders `lang="en"`.
  - Dates use `fil-PH` or `en-PH` formatting.
- *Scope of English mode.* Interface strings switch. Editorial content (articles, pages, polls, community posts, category names) stays as written. These CMS labels can have an optional English version, which falls back to Filipino when empty:
  - navigation items (`navigation_items.label_en`);
  - homepage section titles and descriptions (`homepage_sections.title_en` / `description_en`), which `publish_homepage` and `restore_homepage_to_draft` copy;
  - block links (`label_en` inside a link's settings);
  - Site Settings text: tagline, description, copyright, header CTA, newsletter box, community guidelines and newsletter consent. `localizeSettings()` applies these.

  The columns come from migration `20261106001100_english_labels.sql`. Since ADR-017 the navigation and homepage labels can no longer be edited from Studio; Site Settings text still can.
- *Consent wording.* The newsletter records the consent text in the language the reader saw, so the stored wording matches the wording shown.
- *Theme.*
  - The `bnb_theme` cookie (`light` by default, or `dark`) is shared by the site and Studio and read on the server, so the page never flashes the wrong theme.
  - Since 2026-11-07 (ADR-016) the Studio has no theme toggle of its own. It follows the theme chosen on the public site.
  - Colour roles are CSS variables, redefined under `:root[data-theme="dark"]` (docs/DESIGN_SYSTEM.md §2).
  - The language and theme switches are plain forms that post to server actions, so they work without JavaScript.
- *Favicon.* The default icons (`public/favicon.ico`, `public/brand/icon.svg`, `public/brand/apple-icon.png`) are drawn from the logo mark. A favicon chosen in Studio → Settings → General replaces them on the public site. If that lookup fails, the default stays.

**ADR-016 — Studio console follows Newsmaker (2026-11-07).** The owner asked the Studio to adopt the console of the team's Newsmaker admin. Adopted: the shell, the navigation, the page titles and the article workflow. Kept: Boses colours and logo, TipTap, every permission check and every URL (no route was renamed). This supersedes the navy grouped sidebar, the notification bell and the user menu of ADR-014, and the grouped light sidebar of this ADR's first draft.
- *Sidebar* (`components/studio/sidebar.tsx`, `components/studio/nav.ts`). One flat list under a "PUBLICATION" label, in this order:
  1. Overview (`/dashboard`; it was `/admin` until ADR-022)
  2. Analytics (`/admin/analytics`)
  3. Articles (`/admin/articles`)
  4. Review queue (`/admin/review`)
  5. Reports (`/admin/moderation`)
  6. Tips (`/admin/tips`; added by ADR-024)
  7. Ad inventory (`/admin/ads`)
  8. Audience (`/admin/newsletter`)
  9. Users & roles (`/admin/team`)
  10. Applications (`/admin/applications`)
  11. Site categories (`/admin/taxonomy`)
  12. Settings (`/admin/settings`)
  13. Create article (`/admin/articles/new`)
  14. My account (`/admin/account`)

  An item is shown only to users who hold one of its permissions. This is a convenience: every page and action re-checks on the server. The active item is the longest matching URL. Only the nav list scrolls. The pinned footer holds "Private workspace / Authorized editors only", "View publication" and "Sign out".
- *Top bar* (`app/admin/(studio)/layout.tsx`, `components/studio/route-label.tsx`):
  - a "Workspace / <page>" breadcrumb; sub-pages get their own label, such as "Edit article" and "Article history";
  - article search with a ↵ submit button, from `md` up, for users who can see articles;
  - an identity chip (name and role) that links to `/admin/account`.

  The notification bell and the Studio theme toggle were removed, and `lib/studio/notices.ts` was deleted. The Studio still follows the `bnb_theme` cookie chosen on the public site.
- *Footer.* "Boses ng Bayan · Editorial workspace · <year>".
- *Page headers.* `PageHeader` gained an `eyebrow` prop, a small uppercase kicker above the title. Kickers and titles follow Newsmaker:

  | Page | Kicker / title |
  | --- | --- |
  | `/dashboard` | Publishing center / Welcome, {name}, with an "Access: {role}" chip |
  | `/admin/articles` | Content / Articles |
  | `/admin/review` | Editorial workflow / Review queue |
  | `/admin/moderation` | Trust and corrections / Report inbox |
  | `/admin/ads` | Commercial inventory / Ad inventory |
  | `/admin/newsletter` | Audience |
  | `/admin/team` | Access control / Accounts and roles |
  | `/admin/applications` | Publisher onboarding / Publisher applications |
  | `/admin/taxonomy` | Publication structure / Site categories |
  | `/admin/settings` | Publication settings / Settings |
  | `/admin/articles/new` | Create article |
  | `/admin/articles/[id]` | Edit article |
- *New article* (`/admin/articles/new`) opens the full editor with nothing written yet. The first save or publishing action calls `createArticleFromEditor`. That action inserts the draft (with `articles.create` and RLS), then saves the full form through `saveArticle`, and the page moves to `/admin/articles/[id]`. Autosave starts only once the article exists. If a status change fails after the draft was created, the editor still opens the new draft and shows the error.
- *Publishing card* (`workflow-panel.tsx`). This card lists only the transitions this role may take at the current status, plus Save draft or Save changes. Each transition first saves pending edits, and the transition itself still runs through `transition_article`.
- *Articles list.* Tabs, filters, table and an "a–b of N" pager sit in one card.
- *Review queue* (`/admin/review`, `articles.review`). Lists `pending_review` articles, oldest submission first. The available actions are:
  - Approve;
  - Approve & publish, which needs `articles.publish` and is two transitions; if publishing fails the article stays approved;
  - Return to author, which requires a reason.
- *Image upload in the picker.* The media picker (`components/studio/media-picker.tsx`) is used for the article featured and OG images, the rich-text "Insert image" dialog, Ad inventory, Settings and the category form. Besides searching existing images, it has an "Upload a new image" area: a file, required alt text (up to 300 characters), and an optional caption (up to 600) and credit (up to 200). It calls the server action `uploadImage` (`app/admin/(studio)/_media/actions.ts`), which:
  - requires `media.upload`;
  - accepts images only (JPEG, PNG, WebP, GIF, AVIF), with the bytes sniffed by `storeUpload` in `lib/studio/media.ts`;
  - removes the stored object again if the `media_assets` insert fails.

  The uploaded image is selected in the picker straight away. Metadata is set at upload time; there is no screen to edit or delete existing media (ADR-017).

**ADR-017 — Studio modules removed (owner decision, 2026-11-07).** The owner asked for these Studio modules to be deleted. The owner explicitly kept Analytics and Settings.
- *Removed routes:*
  - Pages (`/admin/pages`) and `/admin/preview/pages`;
  - Media Library (`/admin/media`);
  - Homepage Builder (`/admin/homepage`), `/admin/preview/homepage` and `GET /admin/homepage/articles`;
  - Navigation (`/admin/navigation`);
  - SEO & redirects (`/admin/seo`);
  - Polls admin (`/admin/polls`), including `GET /admin/polls/[id]/export`;
  - the Audit log viewer (`/admin/audit`).
- *Removed code:* `src/lib/studio/{homepage,pages,redirects,notices}.ts` and the redirect validation unit tests.
- *Unchanged:* database tables, RLS, RPCs and migrations. The public site still reads published pages, the published homepage configuration, navigation, polls (voting still works), redirects and SEO settings from the database. Audit rows are still written (`audit_row_change`, `write_audit`).
- *What the owner can no longer do from Studio:*
  - change the homepage layout, its blocks, the hero or the featured poll, or preview a homepage draft;
  - create, edit, publish or archive static pages (they stay as stored; in the base seed they are drafts);
  - edit header and footer navigation, including the English labels from ADR-015;
  - edit the SEO defaults (including `seo.allow_indexing`) or manage redirects;
  - create, edit, open, close or archive polls, or export poll votes as CSV;
  - browse the full audit log. Read `audit_logs` with SQL instead. The team member page (`/admin/team/[id]`) still shows that member's last 20 audit entries to `audit.view` holders;
  - edit the metadata of existing media, replace a file, or delete media.

  These changes now need SQL against the database, or the modules restored from Git history.
- *Permissions.* `pages.manage`, `homepage.manage`, `navigation.manage`, `seo.manage`, `polls.manage`, `polls.view_results`, `media.manage_any` and `audit.view` still exist in the matrix and in RLS. No Studio screen manages those areas any more. Two small uses remain: `polls.view_results` or `polls.manage` shows the poll figures on the Overview page, and `audit.view` shows the audit panel on a team member's page.

**ADR-018 — Publisher applications without self-registration (2026-11-07).** The spec forbids public admin registration (§4.10, §9). The owner wanted people to be able to ask to join the newsroom. The public form at `/admin/apply` (reachable signed out; `src/proxy.ts` lets it through) therefore stores only a request:
- An application creates no auth account and grants no access. The row lives in `publisher_applications` (migration `20261107000200`).
- Inserts go only through the service-role function `submit_publisher_application`. The `submitApplication` server action calls it after Zod validation, a honeypot check and a per-network rate limit (`application`, 3 per hour).
- Each email can have only one pending application. Duplicates are silently ignored, and the reply is the same for every email, so the form cannot be used to find out who has applied or who is staff.
- Only `users.manage` holders (Owner and Administrator by default) can read applications, in Studio → Applications (`/admin/applications`). RLS gives them SELECT only, and UPDATE is revoked from `authenticated`, so no one can update rows directly. Decisions go only through the audited `review_publisher_application`. It allows only pending → approved or rejected, requires a reason for a rejection, and writes an `approve_application` or `reject_application` audit row with no personal data.
- Only an administrator's approval sends an invitation, and it is the normal Studio invitation (`inviteStaff` in `src/lib/studio/invite.ts`: Supabase Auth invite, then `set_user_role` run as the administrator; team invitations use the same helper). Approval can grant only Writer or Moderator. If the applicant is already staff, the application is marked approved without a new invitation or role change.
- Only the network hash is stored, never the raw IP. Reviewed applications are deleted 180 days after the decision by `purge_old_publisher_applications`, which runs in the daily `/api/cron/retention` job.

**ADR-019 — Preview content on the hosted project (2026-11-12).** After the first production deployment the live site was empty, and the request was to load the local preview content into the production Supabase project. This replaces the first safeguard of ADR-013 (the seed could never reach production). The other two still hold: generic content and no-attribution photos.
- `pnpm seed:demo` still refuses a hosted Supabase URL by default. It runs there only when `SEED_DEMO_REMOTE_HOST` equals the project's exact hostname.
- On a hosted project it creates only the two desk accounts the content references: `editor@bosesngbayan.test` (uploader and reviewer) and `writer@bosesngbayan.test` (byline). It never creates the moderator, analyst or administrator accounts there. When the run ends, also after a failure, both accounts get a random password that is not printed, and a ban, so nobody can sign in as them.
- The Owner must exist first: `set_user_role` refuses to assign any role while there is no active Owner.
- Run once on 2026-11-12 against `civmfyqegywwiofhqcya`: 13 articles, 2 polls with zero votes, 4 community posts, 19 photos, the 6 starter pages published with placeholder text, and the homepage draft published.
- The stories are not reporting. Before the site is promoted, replace them with real stories or delete them, and replace the placeholder page text.

**ADR-020 — Public site and Studio on separate origins, one codebase (2026-11-12).** The request was for `bosesngbayan.com` and `admin.bosesngbayan.com` as two Vercel projects from the one repository, the way the team's other publications are deployed. Both projects build the same app, and the request's host decides what is shown.
- `NEXT_PUBLIC_SITE_URL` is the readers' origin and `NEXT_PUBLIC_ADMIN_URL` is the Studio origin. Both projects carry both values. With `NEXT_PUBLIC_ADMIN_URL` unset (local development) everything stays on one host.
- `src/proxy.ts` calls `crossHostRedirect` (`src/lib/host-routing.ts`, unit-tested). A `/admin` path on any host other than the Studio host is redirected to the Studio origin. On the Studio host, `/` opens `/dashboard` (ADR-022) and any other public path is redirected to the site origin. API routes and files with an extension are outside the proxy matcher and answer on both hosts.
- This is routing only. Permissions are still enforced by every Studio page, server action and RPC, and by RLS.
- Invitation, recovery and email-change links use `adminUrl()` so they open on the Studio origin. Supabase Auth must list `<Studio origin>/admin/auth/callback` as a redirect URL.
- Both projects read the same Supabase project and pages render per request (ADR-004), so a story published in Studio shows on the public site with no cross-project cache step.
- `CRON_SECRET` is set only on the public project, so the jobs in `vercel.json` do their work once. On the Studio project the cron routes answer 401.
- Rejected: moving Studio into its own Next.js app in a workspace. It would rewrite working code and duplicate the shared data layer with no visible gain.

**ADR-021 — Studio follows the Newsmaker console in look and page shape (2026-11-12).** The request was to reverse-engineer the Newsmaker console (`Newsmaker/apps/admin`) and apply it to Studio. ADR-016 had already copied the shell, the menu, the titles and the article workflow; this pass closes the remaining gaps found by comparing the two code bases screen by screen.
- *Look.* The Studio UI kit (`components/studio/ui.tsx`) takes Newsmaker's measurements: 10px-radius panels with a 1px border and one soft shadow, a 10px kicker over a 28px title, one bordered strip for figures (`StatStrip`), status badges with a dot, pill tabs and search in one toolbar (`Toolbar`, `ToolbarTabs`, `ToolbarSearch`), record rows for lists (`RecordList`, `RecordRow`) and a text pager. Controls are restyled only inside `.studio` (`globals.css`): 7px corners, a neutral secondary button, an outlined danger button, visible field borders, no press-scale. Colours stay on the Boses tokens, so the dark theme still works; Newsmaker's console has no dark theme.
- *Shell.* 232px sidebar with a tint and a 3px bar on the current page, 68px top bar, 1440px content column, tinted avatar. Sidebar rows are 40px with 4px gaps, not Newsmaker's 44px and 6px, because Boses has two more entries (Analytics, Settings) and all 13 must fit a 900px-tall screen. The mobile switch stays at 1024px and the menu button stays a fixed control at the top left (Newsmaker: 800px, inside the top bar).
- *Overview.* One linked strip (Articles, Reads, Newsroom users, Open reports, Active ads, Subscribers; each cell only for holders of the matching permission), then "Recently updated" beside "Editorial workflow". The range filter, trends, top lists, activity log and metric definitions that the spec asks for (§4.1) stay below.
- *Lists.* Articles, Review queue, Reports, Ad inventory, Audience, Users & roles, Applications and Site categories use the same toolbar, rows and pager. Page sizes follow Newsmaker (articles 12, review 10, reports 10, ads 12, accounts 8, applications 10, subscribers 25).
- *Kept from Boses on purpose:* TipTap, the seven article statuses with approve and return-with-reason, the `/admin` URLs, invitation-only accounts, the permission matrix, the category, author and sort filters, CSV export, suppression of subscribers, ad date windows, and Studio loading and error screens of its own (new in this pass).
- *Not taken from Newsmaker:*
  - account deletion, by the person or by an administrator: `articles.author_id` refuses it for anyone with articles, and Boses deactivates instead;
  - hard-deleting a subscriber: it would erase the consent record, so unsubscribe and suppress stay;
  - requiring a cover image and an excerpt before publishing: the workflow rules in `transition_article` are unchanged;
  - public registration and the block editor (already decided in ADR-016 and ADR-018);
  - the "Enquiries" tab and staff profile photos: both need new data (a public contact form and table; a private storage bucket) and wait for a decision.

**ADR-022 — The Studio Overview is at `/dashboard` (2026-11-12, owner decision).** The owner asked for `https://admin.bosesngbayan.com/admin` to be `https://admin.bosesngbayan.com/dashboard`, and chose the narrow form: only the Overview moves. Every other Studio page keeps its `/admin/...` address, including sign-in and the emailed-link callback, so no Supabase Auth setting or email template changed.

- *How:* the Overview page file is `src/app/dashboard/page.tsx`. `src/app/dashboard/layout.tsx` re-exports the Studio layout, so the page has the same shell and the same `requireStaffPage()` check. Its loading and error screens are re-exports too.
- *Routing:* `STUDIO_HOME` and `isStudioPath` in `src/lib/host-routing.ts` are the one definition of what counts as Studio: `/dashboard`, anything later added under it, and everything under `/admin`. The path is percent-decoded first, as the router does, and a malformed escape counts as Studio so it gets the sign-in check. The proxy treats `/dashboard` like any `/admin` page (session refresh, signed-out redirect to sign-in, `no-store`, `noindex`) and redirects `/admin` to `/dashboard` with its query string, so old bookmarks keep working. On the Studio host `/` opens `/dashboard`; on the public host `/dashboard` goes to the Studio origin.
- *Also changed:* the menu entry, the logo link, the redirect after sign-in, the "no access" redirect (`/dashboard?denied=1`), the callback's default destination, and `robots.txt`.
- *Consequences:* the console has two address shapes (`/dashboard` and `/admin/...`); this supersedes the "`/admin` URLs kept" note in ADR-021 for the Overview only. A public page can no longer use the slug `dashboard`. Moving between the Overview and another Studio page re-renders the shell, because the two sit under different layouts.

**ADR-023 — The client's mission statement (2026-11-13, client decision).** The client sent the publication's mission statement: Boses ng Bayan is an independent public-interest research, news and investigative journalism platform and a watchdog of public service, with the tagline "The People's Voice. The Public's Watchdog." It is applied as content, in the client's own English words, by the data migration `supabase/migrations/20261113000100_mission_statement.sql`.

- *What changed:* Site Settings tagline and description (Filipino and English fields hold the same text; the description is shown in the footer and the RSS feed, the tagline in the homepage's screen-reader heading), the SEO default title and description, and the About page (`/tungkol`), whose body was still the starter placeholder. The page title stays "Tungkol sa Boses ng Bayan"; its summary is the tagline.
- *Why a migration:* the Pages and SEO modules were removed from Studio (ADR-017), so the About page and the SEO defaults cannot be edited there. `supabase/seed.sql` carries the same settings for fresh databases. The tagline and description can still be changed in Studio → Settings.
- *Previous values (for rollback):* tagline "May boses ka. May saysay ang opinyon mo." / "You have a voice. Your opinion matters."; description "Balitang mahalaga sa bawat Pilipino — mula sa bansa, sa rehiyon, at sa inyong komunidad." / "News that matters to every Filipino — from the nation, the regions and your community."; SEO default title "Boses ng Bayan — Balita, Botohan at Usapang Bayan"; SEO default description "Makibahagi sa mga usaping mahalaga sa araw-araw na buhay ng bawat Pilipino."
- *Not done:* no Filipino translation was written (the client wrote in English; inventing a translation of brand copy was avoided). The channel for reporting suspected corruption that the statement asks for was built next, as ADR-024.

**ADR-024 — Tip line for reporting suspected corruption (2026-11-13).** The mission statement (ADR-023) calls on every Filipino to report suspected corruption and expose wrongdoing through credible evidence. The site had no private channel for that: Usap Bayan submissions are published after moderation, and the contact details are empty. Added a tip line, modelled on the publisher applications (ADR-018).

- *Public:* `/mag-ulat` ("Mag-ulat ng katiwalian" / "Report corruption"), a form with subject, details, optional agency, location, up to five https evidence links, and an optional name and contact, plus a "Before you send" list of safety notes. It posts JSON to `POST /api/public/v1/tips` (same-origin check, Zod, honeypot, `tip` rate limit of 3 per network per hour, failing closed). Linked from the header (`Mag-ulat`) and the footer (`Mag-ulat ng Katiwalian`) through navigation items, and listed in the sitemap.
- *Private by construction:* tips live in `public.tips`, written only by the service-role function `submit_tip()`. RLS lets `tips.manage` holders read; nobody can insert, update or delete directly. Tips are never shown on the public site.
- *Who reads them:* the new permission `tips.manage`, granted to Owner, Administrator and Editor. Not Moderator (they handle public community content) and not Writer or Analyst. Studio → Tips (`/admin/tips`) lists them by status (New, Reviewing, Verified, Dismissed) with search; `review_tip()` re-checks the permission, requires a note to dismiss, and audits each change with the two statuses only, never the tip's text. The form carries the tip's `updated_at`; if another editor saved the tip in the meantime, `review_tip()` refuses the change (`tip_changed`) instead of overwriting their status and note, and the page reloads with a warning. Outcomes are shown by the page after a server redirect (as on Applications) because a tip whose status changes leaves its tab, and its form with it. Evidence links are shown with their real host in bold (punycode for lookalike domains) and any `user@` part removed, and open with no referrer.
- *Privacy:* the tip row holds no IP address, network hash or user agent. The rate-limit key is hashed under its own scope (`network:tip`), so the short-lived bucket (deleted after a day) cannot be matched to the network hashes stored with comments, community posts or applications. `/mag-ulat` is not page-view tracked, so a visit there leaves no analytics row next to a tip's arrival time. Name and contact are optional. Dismissed tips are deleted 180 days after dismissal by the daily retention job (each purge in that job runs on its own, so one failing does not hold back the others); verified and open tips stay.
- *Accepted risks (security review, 2026-11-13):* (1) the only flood control is the per-network limit and the honeypot, so a spam run from many networks could bury real tips; a self-hosted proof-of-work challenge is the next step if that happens. (2) The hosting provider (Vercel) keeps its own short request logs with IP addresses; the page says so and suggests sending from a network not tied to the sender. (3) Reading a tip is not audited, only status changes. (4) Database backups keep deleted tips until the backups expire. (5) A verified tip keeps the sender's contact until someone removes it with SQL; there is no Studio control for that.
- *Not built:* file uploads (evidence is by link only: uploads would need malware handling and a private bucket, and a file's metadata can identify its sender), email alerts to editors when a tip arrives (no email provider is configured), and a way for a sender to follow up on a tip. The page warns that a shared-file link can show its owner's name.
- *Rollout:* the table, functions and permission are in `20261113000200_tips.sql`; `20261113000250_review_tip_conflict_code.sql` changes the stale-form error's SQLSTATE from `40001` to `22023`, because PostgREST retries `40001` as a transient serialization failure and the request never returned (found by the end-to-end check before launch; nothing was written); the header and footer links are in `20261113000300_tip_line_nav.sql`, applied only after the page was deployed so the links never pointed at a missing page.

## 6. Environment variables

See `.env.example`. Public values (`NEXT_PUBLIC_*`) are validated by `src/lib/env.ts`; secrets by `src/lib/server-env.ts`, which is server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `HASH_SECRET` (≥32 characters)
- `CRON_SECRET` (≥32 characters; when unset, the cron routes are disabled)

## 7. External integrations

| Integration | Status |
| --- | --- |
| Supabase Auth email (invites, recovery) | Uses the Supabase project's SMTP settings. Configure custom SMTP in production. |
| Newsletter campaign sending | Not implemented. Subscribers, consent, unsubscribe and CSV export work. Studio shows the provider as "not configured". `RESEND_API_KEY` is reserved for a future integration and is not read by any code. |
| Analytics provider | None. First-party `page_view_events` only. |
