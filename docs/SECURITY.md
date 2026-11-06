# Boses ng Bayan — Security

Scope: the public website, the Studio console, the public and cron APIs, and the Supabase database and storage.
See `ARCHITECTURE.md` §3 for the data-access boundaries this document relies on.

## 1. Threat assumptions

| Actor | Can | Must not be able to |
| --- | --- | --- |
| Anonymous visitor | Read published content; vote; subscribe; submit comments, perspectives and reports | Read drafts or private data; publish; inflate votes cheaply; enumerate subscribers; inject script |
| Signed-in staff | What their role's permissions grant (`docs/ADMIN_RBAC.md`) | Escalate their own role; act on resources their permissions exclude (for example, a Writer editing another writer's draft or publishing) |
| Compromised staff session | Damage limited to that role's permissions; every sensitive action is audit-logged | Touch owner-level controls unless the session is an Owner's |
| Automated abuse (bots, scripts) | Hit public endpoints | Bypass rate limits, which are DB-backed and fail closed on write paths, or the honeypot and origin checks |

## 2. Authentication

- Supabase Auth with email and password. Sessions are httpOnly cookies managed by `@supabase/ssr`.
- `src/proxy.ts` refreshes the session on every `/admin` request and redirects signed-out users to `/admin/login`. Admin responses carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- **No public registration.** Staff join only through invitations sent by a user with `users.manage`, using the Auth admin API on the server. The callback (`/admin/auth/callback`) restricts `next` to an allowlist of internal paths, so it cannot be used as an open redirect.
- Sign-in is rate-limited (10 per 15 minutes per network) and returns one generic error. Password reset returns the same message whether or not the account exists.
- Passwords need at least 12 characters with lower case, upper case and a digit. This is enforced both by Supabase Auth (`config.toml`; mirror it in the production dashboard) and by `/admin/auth/update-password` and `/admin/account` (shared schema `src/lib/auth/password.ts`).
- Changing a password from `/admin/account` requires the current password (re-verified with Supabase before `updateUser`), so an unattended open session cannot be used to take over the account. Email changes need confirmation from both addresses (`double_confirm_changes`). The auth callback only redirects to an allowlist (`/admin`, `/admin/auth/update-password`, `/admin/account`).
- Production: add `https://<domain>/admin/auth/callback` to the Supabase Auth redirect URLs, or reset and email-change links fall back to the site URL.
- Deactivated accounts (`profiles.is_active = false`) fail `requireStaff*`, and `has_permission()` returns false for them.
- **Owner bootstrap:** `pnpm bootstrap:owner --email …`
  - runs once with the service-role key from a trusted terminal, and refuses if an Owner exists;
  - prints a temporary password once; change it at first sign-in;
  - is audit-logged as `owner.bootstrap`.

## 3. Authorization

- Roles: owner, administrator, editor, writer, moderator and analyst. Each role maps to granular permissions in `role_permissions`, seeded in `supabase/seed.sql`. The matrix is in `ADMIN_RBAC.md`.
- **Server actions and route handlers** call `requirePermission()`, which reads the role from the database, never from client input.
- **Database:**
  - RLS is enabled on every table;
  - policies call `has_permission()` / `is_staff()`;
  - SECURITY DEFINER functions check permissions themselves and pin `search_path = public`.
- **Ownership rules** are enforced in policies and RPCs, not only in the UI:
  - writers can edit only their own drafts;
  - only the `*.publish` permissions can publish;
  - only Owners can grant or revoke `owner`;
  - the last active Owner cannot be removed or demoted.
- Hidden navigation and disabled buttons are only a convenience. Every action re-checks on the server.

## 4. Input handling

- Zod schemas validate every route-handler body, server-action payload and homepage block. Unknown keys are dropped.
- **Rich text:**
  - TipTap JSON is structurally validated and rendered on the server;
  - the output passes the allowlist sanitizer `sanitizeRichHtml`: no scripts or event handlers; `http`, `https` and `mailto` schemes only; iframes limited to YouTube embeds; links forced to `rel="noopener noreferrer nofollow"`;
  - only sanitized HTML is stored, and it is the only HTML rendered with `dangerouslySetInnerHTML`.
- Article JSON-LD escapes `<`, so a `</script>` breakout is impossible.
- Link fields (CTA, navigation, redirects, canonical) accept only same-site paths starting with `/` (not `//`) or `https://` URLs. Redirect loops are rejected.
- **Uploads:**
  - server action plus a storage policy (`media.upload`); objects go under `<uid>/`;
  - magic-byte sniffing means the declared type must match the content;
  - SVG and HTML are rejected; the limit is 4 MB per file (the Vercel body limit); the bucket itself caps objects at 10 MB.
- Community text is plain text, rendered escaped by React; no HTML is accepted.

## 5. Public write endpoints

These are the poll vote, newsletter subscribe and unsubscribe, comments, community posts, reports and page-view tracking. Each one:

1. Requires a same-origin `Origin` or `Referer`. This is the CSRF defence for JSON POSTs.
2. Rejects bodies that fail Zod validation. The hidden honeypot field (`website`) must be empty, so naive form-filling bots fail validation and nothing is written.
3. Applies a DB-backed fixed-window rate limit keyed by `HMAC(network)`. It **fails closed**.
4. Writes through a service-only RPC that re-validates state: poll open, option belongs to the poll, duplicate voter hash, moderation status.
5. Returns uniform envelopes. Errors never echo internals; details go to the server log through `logServerError`, without tokens or personal data.

Comments and community posts start as `pending` and are published only through the moderation queue when moderation is enabled.

## 6. Privacy

- Stored identifiers are HMAC-SHA256 hashes keyed by `HASH_SECRET`; raw IPs, user agents and voter tokens are never persisted.
- Visitor hashes rotate daily (Manila day), and likely bots are dropped.
- `purge_old_analytics()` deletes page-view events older than 13 months and stale rate-limit rows.
- Newsletter records hold only the email address, consent (`consent_at`, `consent_text`), the source and status. Unsubscribe uses an unguessable per-subscriber UUID token through a POST, so link scanners cannot unsubscribe people. Suppressed addresses are kept only to honour the opt-out.
- Rotating `HASH_SECRET` invalidates every existing voter and visitor hash. Do this deliberately.
- Reader preferences are two cookies: `bnb_lang` (`fil`/`en`) and `bnb_theme` (`light`/`dark`).
  - They are set by server actions (`src/lib/preferences.ts`) that accept only those values.
  - They are `HttpOnly` and `SameSite=Lax`, `Secure` in production, and last one year.
  - They hold no identifier and are not linked to analytics.

## 7. Secrets

| Secret | Where | Exposure |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server env only, read by `src/lib/server-env.ts` (`server-only`) | Never `NEXT_PUBLIC_`, never logged |
| `HASH_SECRET`, `CRON_SECRET` | Server env | Cron uses a timing-safe Bearer comparison; cron routes are disabled when the secret is unset |
| Anon key, Supabase URL, site URL | `NEXT_PUBLIC_*` | Public by design; RLS is the protection |

Production browser source maps are disabled (`productionBrowserSourceMaps: false`). Site settings in the CMS hold no secrets.

## 8. HTTP hardening

`next.config.ts` sends the following on every route:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- a restrictive `Permissions-Policy`
- HSTS (2 years, preload)

`X-Powered-By` is off.

**Content-Security-Policy** is set per request by `src/proxy.ts` for every page, including Studio:

- `script-src 'self' 'nonce-…' 'strict-dynamic'`. Next attaches the nonce to its own scripts, and every page renders dynamically so the nonce is always fresh. Development adds `'unsafe-eval'` for React refresh.
- `style-src 'self' 'unsafe-inline'`, needed for the brand variables, `next/font` and TipTap inline styles. Inline styles cannot execute script.
- `img-src 'self' data: blob: https:` plus the configured Supabase origin, because media can be an external https URL and a local Supabase stack serves storage over http.
- `connect-src 'self'` plus the Supabase origin.
- `frame-src` is limited to YouTube.
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `upgrade-insecure-requests` in production.

The article JSON-LD is a non-executable data block (`application/ld+json`) with `<` escaped.

## 9. Production checklist

- [ ] Supabase: apply migrations (`supabase db push`), then load `seed.sql` (roles, permissions and base taxonomy only). Do **not** run `pnpm seed:demo`, which refuses non-local URLs anyway.
- [ ] Supabase Auth:
  - disable public sign-ups;
  - set Site URL and redirect URLs to the production origin plus `/admin/auth/callback`;
  - configure custom SMTP;
  - enable leaked-password protection.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical https origin. It drives CSRF origin checks, canonicals and invitation links.
- [ ] Generate fresh `HASH_SECRET` and `CRON_SECRET` (≥32 random characters) and store them only in Vercel environment variables.
- [ ] Bootstrap the Owner, then sign in and change the temporary password.
- [ ] Confirm the `media` bucket policies exist (migration `…0400_storage.sql`).
- [ ] Check the browser console on the deployed site for CSP violations (§8). Add any new embed origins to `frame-src`.
- [ ] Turn on Supabase point-in-time recovery or daily backups (see `DEPLOYMENT.md`).
- [ ] Review the audit log after the first week.
