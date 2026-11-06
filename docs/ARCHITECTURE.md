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
      preview/         protected draft previews (articles, pages, homepage)
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
    studio/            Studio data helpers (dashboards, ranges, CSV, reorder, redirects …)
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
  seed-demo.ts         local-only labelled demo content
tests/
  unit/                pure logic
  db/                  migrations + RLS + RPC behaviour in PGlite
```

## 3. Data-access boundaries

`src/lib/supabase/server.ts` exposes exactly three clients. All are server-only (`import "server-only"`).

1. **Session client** (`createSessionClient`). Used by Studio pages, server actions and previews. It runs as the signed-in user, so every query is filtered by RLS. Studio never needs the service role for content work.
2. **Public client** (anon key, no cookies). Used by `src/lib/cms/*` for public reads. RLS only exposes published, public rows, for example through `article_is_public(status, published_at)`.
3. **Service client** (service-role key). Used only for:
   - narrow public-write RPCs (votes, comments, submissions, reports, newsletter, page views), called after the route handler has validated, rate-limited and checked origin;
   - scheduled jobs;
   - Supabase Auth admin calls (team invitations, deactivation).

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
- **Preview**: `/admin/preview/*` routes. They require a staff session, read drafts through the session client, and send `noindex` and `no-store`. Public endpoints never return drafts.

## 5. Architecture decision records

**ADR-001 — Supabase for database, auth and storage.** The repository was new, and the spec's default fits. One vendor covers Postgres + RLS, Auth (invitations, recovery, PKCE), and Storage with policies. It has a free tier for staging.

**ADR-002 — Local-only development until account turnover.** The client's GitHub, Vercel and Supabase accounts are not yet available. Nothing is provisioned remotely, and no repository or project is created. Everything runs against `supabase start` (Docker) or PGlite tests. Deployment steps are documented in `docs/DEPLOYMENT.md`.

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

**ADR-011 — Redirects.** The `redirects` table drives `redirectOrNotFound()` on 404s, with 301/308 treated as permanent. Destinations must be same-site paths or https URLs, and loops are rejected (`lib/studio/redirects.ts`). `hit_count` exists in the schema but is not incremented yet, which would require a service write on every redirect.

**ADR-012 — News-first homepage (2026-11-06).** At the owner's request the public site was redesigned as a news site after the Morning template (visual language) and Istorya (structure); the poll-led hero is no longer the default.
- New block type `top_stories` (migration `20261106001000_top_stories_block.sql`, schema in `lib/homepage/blocks.ts`): lead from featured, latest or a manual pick, plus rail and below-row counts. Its lead image is the only preloaded image on the homepage.
- `latest_articles` gained `with_sidebar`, which shows a ranked most-read list only when tracked views exist.
- Inter is the single font family; `--font-serif` maps to it so legacy classes stay harmless.
- The `hero` block remains available in the homepage builder.

**ADR-013 — Unlabelled local preview content (2026-11-06).** The owner asked for the local site to read as a real publication, with no "[Demo]" labels, disclaimers or photo credits. The spec (section 0) asks for clearly labelled demo content, so the following safeguards replace the visible labels:
- `pnpm seed:demo` refuses any non-local Supabase URL (`assertLocal`), so this content cannot reach production.
- Content is generic: no real people, quotes, statistics, named institutions or events; bylines are newsroom desks (`Editorial Desk`, `Boses ng Bayan Newsroom`); polls start with zero votes.
- Photos are CC0, public domain or Unsplash License only (no attribution required); provenance stays in `supabase/seed-media/CREDITS.json`. CC BY / BY-SA photos were removed because they legally require a visible credit.
- Before launch, the newsroom replaces all preview content with real reporting (a fresh production database never runs the seed).

**ADR-014 — Studio shell follows the RapidPoll console (2026-11-06).** At the owner's request the Studio uses the same console layout as the team's RapidPoll admin: fixed navy sidebar grouped Pangkalahatan / Nilalaman / Homepage at Site / Komunidad / Administrasyon / Ikaw, a white top bar with article search, a notification bell (pending review, moderation queues) and a user menu (Aking Account, view site, logout), and rounded-2xl panels with a soft card shadow. Boses colours, logo and Filipino labels are kept. The signed-out screens (login, forgot password, new password) share `AuthShell`.

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
