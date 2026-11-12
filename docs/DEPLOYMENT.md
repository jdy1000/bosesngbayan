# Boses ng Bayan — Local setup, deployment and owner bootstrap

Status (2026-11-12): live at `https://bosesngbayan.vercel.app`.

- GitHub `jdy1000/bosesngbayan`, production branch `main`. A push to `main` deploys to production.
- Vercel project `bosesngbayan` in team `jdy2`. No custom domain yet.
- Supabase project `civmfyqegywwiofhqcya` (Mumbai, `ap-south-1`).
- Still open: Supabase Auth settings (section 2, step 4), owner bootstrap (section 4), and the go-live checklist (section 5).

The steps below are kept for a rebuild or a move to other accounts.

## 1. Local development

Prerequisites:
- Node ≥ 20.9
- pnpm 11 (`corepack enable`)
- Docker Desktop, for the local Supabase stack

```bash
pnpm install
pnpm db:start                 # supabase start → prints API URL, anon key, service_role key
cp .env.example .env.local    # paste the printed URL and keys; generate HASH_SECRET and CRON_SECRET
pnpm db:reset                 # applies supabase/migrations/* then supabase/seed.sql
pnpm db:types                 # regenerate src/lib/database.types.ts after schema changes
pnpm bootstrap:owner --email you@example.com --name "Your Name"
pnpm seed:demo                # optional: labelled demo staff, articles, polls (0 votes), photos
pnpm dev                      # http://localhost:3000  ·  Studio: /admin
```

- `seed:demo` refuses any non-local Supabase URL.
- Demo staff use `@bosesngbayan.test` addresses and one shared password, which the script prints.
- Local Auth emails (invites, password resets) appear in Inbucket at http://127.0.0.1:56324.

Checks:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:e2e                 # Playwright; needs `pnpm dev` + a seeded local stack
```

`pnpm test` does not need Docker: database tests run every migration in PGlite.

## 2. Supabase (production project)

1. Create the project in the client's organisation. Region: Singapore (`ap-southeast-1`) is closest to Manila.
2. Link and push the schema:
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
   `db push` applies `supabase/migrations/*` only.

   If the direct host `db.<ref>.supabase.co` does not resolve (it is IPv6-only), push through the session pooler instead: `pnpm exec supabase db push --db-url "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"`. Copy the exact host from Dashboard → Connect → Session pooler; the `aws-0` / `aws-1` prefix depends on the project.
3. Load the base seed (roles, permission matrix, starter categories, topics, menus, pages, homepage) **once**. Run `supabase/seed.sql` in the SQL editor, or with `psql "$DATABASE_URL" -f supabase/seed.sql`. It contains no demo articles or people.
4. Auth settings:
   - **disable "Allow new users to sign up"**;
   - Site URL = `https://<domain>`;
   - Redirect URLs = `https://<domain>/admin/auth/callback`;
   - configure custom SMTP;
   - set the email templates' links to `{{ .SiteURL }}/admin/auth/callback?token_hash={{ .TokenHash }}&type=<invite|recovery>`.
5. Storage: the `media` bucket and its policies come from migration `…0400_storage.sql`. Confirm they exist after the push.
6. Backups: enable daily backups. Use point-in-time recovery on a paid plan. Test a restore before launch.

## 3. Vercel

1. Import the client's GitHub repository. Framework preset: Next.js. Install command: `pnpm install`.
2. Environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project API URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<domain>`, the canonical origin, no trailing slash |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**sensitive**) |
   | `HASH_SECRET` | ≥32 random characters (**sensitive**); never rotate casually |
   | `CRON_SECRET` | ≥32 random characters (**sensitive**); Vercel Cron sends it as a Bearer token |

   Generate secrets with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
   The live project has these on Production only. A preview build would otherwise run against the live database, and its own URL would not match `NEXT_PUBLIC_SITE_URL`.

   `vercel.json` runs the functions in `bom1` (Mumbai), the same region as the live Supabase project. If the database moves, change `regions` to match.
3. Cron jobs come from `vercel.json`:
   - `/api/cron/publish` at 16:05 UTC = 00:05 Manila;
   - `/api/cron/retention` at 19:30 UTC = 03:30 Manila.

   Hobby allows daily jobs. Scheduled articles still go live on time, because visibility is computed from `published_at` (ADR-008). The job only tidies the stored status. For frequent runs, use Vercel Pro or Supabase `pg_cron`, calling `select public.publish_due_articles();` every 5 minutes.
4. Add the custom domain, then update `NEXT_PUBLIC_SITE_URL` and the Supabase Auth URLs to match.

## 4. Owner bootstrap (production)

Run from a trusted machine, never in CI:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service key> \
pnpm bootstrap:owner --email owner@client.ph --name "Owner Name"
```

The script refuses if an Owner already exists. It prints a one-time temporary password: sign in at `/admin/login` and change it at once (or use "Nakalimutan ang password?"). Invite every other staff member from **Studio → Users & roles**, or approve their application in **Studio → Applications** (ADR-018). Further Owners can be promoted only by an existing Owner.

## 5. Go-live checklist

- [ ] Every item in `SECURITY.md` §9.
- [ ] Studio → Settings: site name, logo, favicon, contact and social links.
- [ ] SEO defaults and indexing are no longer editable in Studio (ADR-017). The base seed sets `seo.allow_indexing: true`; if the site must stay out of search engines until launch, change the `seo` row in `site_settings` with SQL.
- [ ] Replace the seeded page bodies (Tungkol, Editorial Policy, Privacy, Terms, Contact) with approved text and publish them. The seed stores them as drafts, and since ADR-017 there is no Studio screen for pages, so this needs SQL (`pages` table).
- [ ] Check the published homepage configuration. The homepage builder was removed from Studio (ADR-017), so the stored layout is what the public site shows; changes need SQL (`homepage_configurations`, `homepage_sections`).
- [ ] Submit `https://<domain>/sitemap.xml` to Google Search Console. RSS is at `/rss.xml`.
- [ ] Smoke test:
  - publish an article and confirm it appears on the homepage;
  - unpublish it and confirm it disappears;
  - vote once, then try again and confirm the second vote is blocked;
  - subscribe and then unsubscribe;
  - post a comment and confirm it appears only after moderation.

## 6. Monitoring and recovery

- Vercel → Logs: server errors are logged as structured `logServerError(event, …)` lines, without personal data.
- Supabase → Reports and Logs: database, auth and storage.
- The `audit_logs` table records sensitive actions: role changes, deactivation, publishing, homepage publish, settings, ad changes, application decisions, deletions. There is no Studio viewer since ADR-017; query the table with SQL. A team member's page in Studio shows that member's last 20 entries.
- **Restore:** use the Supabase backup or PITR to a new project, then repoint the Vercel env vars. Media lives in Supabase Storage and is included in project backups only on plans that back up storage; otherwise export the bucket periodically.
