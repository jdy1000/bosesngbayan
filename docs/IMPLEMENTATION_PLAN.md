# Boses ng Bayan — Implementation plan

The phases follow master spec §13. Live status, check results and defects are in `progress.txt`. This file records the sequence and ownership.

| Phase | Scope | Output |
| --- | --- | --- |
| 0 Reconnaissance | Fresh Next.js scaffold, no git history, Docker unavailable, accounts pending | ADR-001/002/005 |
| 1 Architecture and docs | This `docs/` set, `.env.example`, `CLAUDE.md`, `progress.txt` | docs/* |
| 2 Design system and public site | Tokens; header and nav; 17 homepage block renderers; article, category, tag, region, poll, Usap Bayan, search and static pages; 404 and error; SEO, sitemap, robots, RSS | `src/app/(site)`, `src/components/public` |
| 3 Backend and database | Migrations `0100` core RBAC, `0200` content and workflow, `0300` engagement (polls, community, newsletter, analytics, rate limits), `0400` storage, `0600` media usage, `0800` staff directory; public API; cron | `supabase/`, `src/app/api`, `src/lib` |
| 4 Studio | Auth (login, recovery, invite callback); dashboard; articles and editor with revisions and preview; media; taxonomy; pages; homepage builder and preview; polls; moderation; newsletter; analytics; team and roles; navigation; SEO and redirects; settings; audit | `src/app/admin` |
| 5 CMS → public wiring | All public reads go through `lib/cms` (published only); Studio actions revalidate affected paths | verified per module in `progress.txt` |
| 6 Testing and hardening | PGlite DB tests, unit tests, typecheck, lint, build; Playwright e2e (needs a stack) | `tests/` |
| 7 Production readiness | Owner bootstrap, deployment guide, security checklist | `scripts/bootstrap-owner.ts`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md` §9 |

## Work split

Phase 4 was built in parallel by four subagents, each owning its own route folders and migration number range (0500 / 0600 / 0700 / 0800).

- The primary agent owns the shared layers: `lib/auth`, `lib/supabase`, `lib/cms`, `components/studio/ui.tsx` and `action-form.tsx`, and the public site.
- The primary agent also integrates the agents' work, runs the full check suite and reviews security.

## Remaining before launch

- Run e2e against a real stack.
- Verify the CSP in a real browser against the deployed origin (`SECURITY.md` §8).
- Load the client's real pages and settings.
- Provision accounts per `DEPLOYMENT.md`.
