# Boses ng Bayan — Testing strategy

## Layers

| Layer | Tool | Location | Needs | What it proves |
| --- | --- | --- | --- | --- |
| Database | Vitest + PGlite | `tests/db/*.test.ts` | Nothing (in-process Postgres) | Every migration applies cleanly. RLS allows and denies per role. Workflow transitions and guards. Vote integrity (duplicates, closed polls, options locked after votes). Rate limits. Moderation. Newsletter privacy. Homepage publish and restore. Media-in-use protection. Team invariants. Ad slot RLS and live window. Publisher applications (no direct updates, review rules, retention). |
| Unit | Vitest | `tests/unit/*.test.ts` | Nothing | Sanitizer (XSS), TipTap render, cron auth, HMAC hashing, bot filter, same-origin check, magic-byte sniffing, block schemas and safe hrefs, slug and timezone helpers, CSV escaping (formula injection), date ranges, article editor logic, ad and publisher-application schemas. (The redirect-loop tests were removed with `lib/studio/redirects.ts`, ADR-017.) |
| Types | `tsc --noEmit` | whole repo | Nothing | Typed DB contracts (`database.types.ts` generated from the migrations). |
| Lint | ESLint (`eslint-config-next`) | whole repo | Nothing | React and Next rules, hooks correctness. |
| Build | `next build` | — | Nothing (no DB at build time, ADR-004) | All routes compile, no server-only imports leak to the client. |
| E2E | Playwright | `tests/e2e/*.spec.ts` | Local Supabase stack + `pnpm seed:demo` + `pnpm dev` | Public smoke: homepage, 404, admin gate, a vote and a repeat-vote block, public API hides drafts. Desktop and mobile projects. |

## How the PGlite harness works

`scripts/lib/pglite-supabase.ts` (`createSupabaseLikeDb`) boots PGlite with minimal `auth` and `storage` schemas and the Supabase roles. It then applies `supabase/migrations/*` in order, followed by `supabase/seed.sql`. The same loader generates `database.types.ts`.

`asRole(db, role, userId, fn)` runs a transaction as `anon`, `authenticated` or `service_role`, with `request.jwt.claims` set, so `auth.uid()`, `has_permission()` and RLS behave as in production. `createStaff()` makes a user with a role.

PostgREST and Storage HTTP behaviour (for example, upload size limits enforced by the storage API) is **not** covered here. That belongs to e2e.

## Commands

```bash
pnpm test         # unit + db (≈ 1–3 min cold; PGlite boots per file)
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e     # requires the running local stack (see DEPLOYMENT.md §1)
```

## Rules

- A bug fix comes with a test that fails before the fix. A DB test is preferred when the rule lives in SQL.
- Every permission rule gets both an allowed and a denied case.
- No snapshot tests of markup. Visual checks are done by screenshot review at 375, 768 and 1440 widths.
- Seed or demo data never feeds an assertion about real metrics.

## Current gaps

These are tracked in `progress.txt`:

- E2E has not been run. The Docker or Supabase stack was unavailable on the build machine.
- No automated accessibility scan yet. Add `@axe-core/playwright` to the e2e suite once the stack runs.
- No load testing of the vote endpoint.
