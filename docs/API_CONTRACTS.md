# API Contracts

Source of truth:

- `src/app/api/**/route.ts`
- `src/lib/api/public.ts`
- `src/lib/security/*.ts`
- the Studio route handlers under `src/app/admin/**`
- `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/rss.xml/route.ts`

User-facing messages are in Filipino. The examples below summarise them.

## 1. Conventions

### Envelopes

| Kind | Helper | Success | Error | Cache-Control |
|---|---|---|---|---|
| Public reads (GET) | `publicRead()` | `200 {ok:true, data}` | `404 {ok:false, error}` when the loader returns `null`. `400` on a query `ZodError` (first issue message). `500` generic. | Success: `public, s-maxage=60, stale-while-revalidate=300`. Errors: no header set. |
| Public writes (POST) | `jsonOk()` / `jsonError()` | `{ok:true, ...fields}`. Fields are spread at the top level, **not** under `data`. | `{ok:false, error, ...extra}` | `no-store` |
| Studio JSON routes | `NextResponse.json` | `{items: [...]}` | `{error}` | `private, no-store` |

### Write-path guard (`readJson`)

Every public POST except `/track` goes through `readJson`. It checks, in order:

1. **Same origin.** The `Origin` header must equal the request origin or the origin of `NEXT_PUBLIC_SITE_URL`. If `Origin` is missing, `Referer` is used. If both are missing, the request fails. Failure → `403`.
2. `Content-Type` includes `application/json`, otherwise `415`.
3. The body is at most 16 KiB (16384 characters), otherwise `413`.
4. The body is valid JSON, otherwise `400`.
5. The body passes the zod schema, otherwise `422` with the first issue's message.

### Rate limits

Rate limits use `RATE_LIMITS` in `src/lib/security/rate-limit.ts`.

- **Storage:** a fixed window in Postgres via `check_rate_limit`. The key is `<name>:<networkHash>`.
- **Network hash:** `networkHash = HMAC-SHA256(HASH_SECRET, "network:" + first X-Forwarded-For hop)`, falling back to `x-real-ip`, then `0.0.0.0`.
- **Fails closed:** if the limiter itself errors, the request is refused.
- **On limit:** `429`.

| Name | Max | Window | Used by |
|---|---|---|---|
| `vote` | 20 | 600 s | POST `/polls/[id]/vote` |
| `newsletter` | 5 | 3600 s | POST `/newsletter` and POST `/newsletter/unsubscribe` (shared bucket) |
| `submission` | 3 | 3600 s | POST `/community/posts` |
| `comment` | 10 | 3600 s | POST `/comments` |
| `report` | 10 | 3600 s | POST `/reports` |
| `search` | 60 | 60 s | GET `/search` |
| `login` | 10 | 900 s | `signIn` and `requestPasswordReset` server actions |
| `application` | 3 | 3600 s | `submitApplication` server action (public `/admin/apply` form) |
| `tip` | 3 | 3600 s | POST `/tips` (public tip line `/mag-ulat`). The network hash is used for this bucket only and is not stored with the tip. |
| `track` | 600 | 600 s | POST `/track`; over the limit the view is dropped and the reply is still `204` |

### Honeypot

Some bodies have a `website` field defined as `z.string().max(0).optional()`. Because `readJson` validates before the handler runs, any non-empty value fails the schema with `422`. See Inconsistencies (section 7).

## 2. Public read endpoints (`/api/public/v1`)

All read endpoints use the anonymous Supabase client, so RLS applies. None of them requires same-origin.

| Endpoint | Query | `data` shape | Errors / notes |
|---|---|---|---|
| `GET /articles` | `page` int 1–10000 (default 1). `pageSize` int 1–48 (default 12). `category`, `tag`, `region`: slugs matching `^[a-z0-9-]{1,120}$`. `featured=true`. `breaking=true`. | `Paginated<ArticleCard>` = `{items, total, page, pageSize, totalPages}` | `404` if a given category, tag or region slug does not exist. `region` includes all descendant locations. Ordered by `published_at desc`. |
| `GET /articles/[slug]` | — | `ArticleDetail` | `404` if not public. |
| `GET /categories` | — | `CategorySummary[]` (active only, ordered by `sort_order`, then `name`) | — |
| `GET /categories/[slug]` | — | `CategorySummary` | `404` if missing or inactive. |
| `GET /polls` | `filter` = `active` \| `past` \| `all` (default `all`) | `PublicPoll[]`. Taken from the latest 100 published or closed polls, then filtered and capped at 24. | Definitions only, no results. |
| `GET /polls/[idOrSlug]` | — | `PublicPoll` | The segment is looked up as an id if it is a UUID, otherwise as a slug. `404` if not found. |
| `GET /homepage` | — | `{configurationId, blocks: HomepageBlock[]}` | Published configuration only. Sections that fail the block schema are left out. `404` if nothing is published. |
| `GET /pages/[slug]` | — | `PublicPage` | `404` unless the page is published. |
| `GET /trending` | — | `{id, label, href}[]` | `href` is the explicit `href`, else `/paksa/<category>` if the category is active, else `/tag/<tag>`. Topics with no resolvable link are left out. |
| `GET /search` | `q` trimmed, 2–120 chars. Plus `page`/`pageSize` as for `/articles`. | `Paginated<ArticleCard>` | Rate limit `search`, checked **before** validation. The `429` body is `{ok:false, error}` with no cache header. Uses Postgres `websearch` syntax with the `simple` config. |

### Response types

| Type | Fields |
|---|---|
| `ArticleCard` | `id`, `slug`, `title`, `excerpt`, `published_at`, `content_updated_at`, `reading_minutes`, `is_featured`, `is_breaking`, `is_editors_pick`, `category{id,slug,name}`, `author{id,display_name,slug}`, `image` (`MediaSummary`). |
| `ArticleDetail` | Everything in `ArticleCard`, plus `subtitle`, `body_html`, `first_published_at`, `seo_title`, `seo_description`, `canonical_url`, `source_attribution`, `correction_note`, `allow_comments`, `location{id,slug,name}`, `og_image`, `tags[]`, `contributors[{role_label, profile{id,display_name}}]`, `related_ids[]`. Its `author` also includes `title`, `bio` and `avatar_url`. |
| `MediaSummary` | `id`, `storage_path`, `external_url`, `alt_text`, `caption`, `credit`, `width`, `height`. |
| `CategorySummary` | `id`, `slug`, `name`, `description`, `is_featured`, `seo_title`, `seo_description`, `image`. |
| `PublicPoll` | `id`, `slug`, `question`, `description`, `kind`, `max_choices`, `status` (`published` or `closed`), `is_featured`, `opens_at`, `closes_at`, `results_visibility`, `methodology_note`, `published_at`, `closed_at`, `category`, `options[{id,label,position}]` (sorted). |
| `PublicPage` | `id`, `slug`, `title`, `summary`, `body_html`, `seo_title`, `seo_description`, `canonical_url`, `robots_noindex`, `published_at`, `updated_at`, `og_image`. |
| `PollResults` | `visible`, `has_voted`, `is_open`. When `visible`, also `total_ballots` and `options[{option_id, votes}]`. |

## 3. Public write endpoints (`/api/public/v1`)

All of these require the same-origin JSON guard described in section 1, except `/track`, which checks same-origin but fails silently.

### POST `/polls/[id]/vote`

| | |
|---|---|
| Path | `id` must be a UUID, otherwise `404`. |
| Body | `optionIds`: UUID array of length 1–20. `website`: honeypot. |
| Rate limit | `vote` (20 / 600 s). |
| Voter identity | HttpOnly cookie `bnb_voter`, a random UUID. It is set when missing or malformed: SameSite=Lax, Secure in production, path `/`, max-age 2 years. Only `HMAC("voter:"+token)` reaches the database, together with the network hash. |
| `200` | `{ok:true, status:"ok", message, results}` |
| `409` already voted | `{ok:false, status:"already_voted", message, results}`. This body has no `error` field. |
| `409` closed | `{ok:false, error, status:"closed"}` |
| `422` | `{ok:false, error, status:"invalid"}`. Also returned for honeypot hits and schema failures. |
| Other | `429`; `500`. |

### GET `/polls/[id]/vote`

- Returns `{ok:true, results: PollResults}` with `no-store`.
- Visibility rules are applied by `get_poll_results` using the caller's cookie.
- A non-UUID `id` returns `404`.
- There is no rate limit.

### Other write endpoints

| Endpoint | Body schema | Gate | Rate limit | Success | Errors |
|---|---|---|---|---|---|
| `POST /newsletter` | `email`: trimmed, lowercased, ≤254, valid email. `consent`: literal `true`. `source`: ≤40 chars, `^[a-z0-9_-]*$`, default `site`. `website`: honeypot. | `503` if `newsletter.enabled` is false | `newsletter` | `200 {ok:true, message, status}`. `status` is `"recorded"`, or `"subscribed"` when the address is suppressed. The consent text comes from site settings, not the client. | `429`, `500` |
| `POST /newsletter/unsubscribe` | `token`: UUID | — | `newsletter` (shared) | `200 {ok:true, message}`. The same answer is returned whether or not the token matched. | `429`, `500` |
| `POST /community/posts` | `kind`: `perspective` \| `question`. `title`: 5–200. `body`: 20–5000. `authorName`: 2–80. `authorEmail`: `""` or a valid email ≤254. `authorLocation`: ≤120 (default `""`). `categoryId`: UUID or null. `agree`: literal `true`. `website`. | `503` if `community.submissions_enabled` is false | `submission` | `201 {ok:true, status:"pending"\|"approved", message}` | `429`, `500` |
| `POST /tips` | `subject`: 5–200. `details`: 30–8000. `agency`: ≤200, `location`: ≤120, `contactName`: ≤120, `contact`: ≤200 (each default `""`). `evidence`: the textarea as typed, ≤3000 chars, split on whitespace into at most 5 `https://` URLs of ≤500 chars. `agree`: literal `true`. `hp`: honeypot (≤500); a filled one gets the normal `201` and nothing is stored. | — | `tip` | `201 {ok:true, message}` | `422` (validation), `429`, `500` |
| `POST /comments` | `articleId` or `postId` (UUID; exactly one). `parentId`: UUID or null. `authorName`: 2–80. `authorEmail`: as above. `body`: 2–2000. `website`. | `403` if `publication.comments_enabled` is false | `comment` | `201 {ok:true, status, message}` | `409` when the RPC raises `comments_closed` or `parent_not_found`; `429`; `500` |
| `POST /reports` | `postId` or `commentId` (UUID; exactly one). `reason`: one of the 7 `report_reason` values. `details`: ≤1000 (default `""`). There is **no honeypot**. | — | `report` | `201 {ok:true, message}` | `404` (`target_not_found`), `429`, `500` |
| `POST /track` | `path`: ≤500 chars, matching `^/(?!admin|mag-ulat)[^\s]*$` (Studio and the tip line are never recorded); the query string is stripped. `articleId`: UUID or null. `referrer`: ≤1000 chars (default `""`). | Same-origin, but a mismatch is silent | `track` (silent drop) | Always `204` with `no-store`. | None. It also returns `204` over the rate limit, for cross-origin requests, DNT or GPC, likely bots (user agent shorter than 10 chars, or matching the bot regex), bodies over 2048 chars, invalid JSON or schema, and database errors. Deduplication (30 min) happens in `record_page_view`. |

## 4. Cron endpoints

**Auth.** Both endpoints require the header `Authorization: Bearer <CRON_SECRET>`. The comparison is timing-safe. If `CRON_SECRET` is unset, the endpoint is disabled.

**Unauthorized.** Plain-text `401 Unauthorized`.

**Schedules.** Taken from `vercel.json` (times in UTC).

| Endpoint | Schedule (UTC) | Action | Response |
|---|---|---|---|
| `GET /api/cron/publish` | `5 16 * * *` (00:05 Manila) | Calls `publish_due_articles()` with the service client. Runs `revalidatePath("/", "layout")` if any article was published. | `{ok:true, published:n}` or `500 {ok:false}` |
| `GET /api/cron/retention` | `30 19 * * *` (03:30 Manila) | Calls `purge_old_analytics()`, `purge_old_publisher_applications()` and `purge_old_tips()`, each on its own so one failing does not stop the others. | `{ok:true, result:n, applications:m, tips:k, failed:[]}` (page views, reviewed applications and old dismissed tips deleted). If any purge fails: `500` with `ok:false`, `null` for that purge and its key in `failed`. |

Public visibility does not wait for the publish job, because `article_is_public()` already treats past-due scheduled articles as public.

## 5. Staff-only route handlers

Studio route handlers authenticate with the Supabase session through `getStaffContext()`, which requires an active profile with a role. RLS applies to every query they make.

| Endpoint | Requirement | Query | Response |
|---|---|---|---|
| `GET /admin/api/media` | Any active staff member. `401` if missing. | `q`: ≤80 chars, searches title, file name and alt text | `{items: MediaPickerItem[]}`, up to 48 images: `id`, `url`, `file_name`, `title`, `alt_text`, `credit`, `width`, `height` |
| `GET /admin/auth/callback` | — | `code` (PKCE), or `token_hash` + `type` (invite, recovery, magiclink, email, signup, email_change); `next` | Redirects. `next` is limited to `/dashboard`, `/admin/auth/update-password` and `/admin/account`; anything else, or no `next`, goes to `/dashboard`. Invites are sent to update-password. Failures go to `/admin/login?error=link`. |

### CSV exports

The export uses `requirePermission`. A missing session or permission returns `403 {error}`. The CSV is produced by `toCsv`, `csvResponse`:

- UTF-8 BOM and CRLF line endings.
- Cells starting with `= + - @`, tab or CR are prefixed with `'`.
- `Content-Disposition: attachment`, `private, no-store`.

Rows are fetched in batches of 1000. An audit row is written with `write_audit`, and **if the audit write fails, the export fails**.

| Endpoint | Permission | Query | Columns | Audit action |
|---|---|---|---|---|
| `GET /admin/newsletter/export` | `newsletter.manage` **and** `newsletter.view` | `status` = `subscribed` \| `unsubscribed` \| `suppressed` (anything else exports all) | email, status, consent_given, consent_text, consent_at_utc, source, subscribed_at_utc, unsubscribed_at_utc, suppressed_at_utc, suppression_reason. Unsubscribe tokens are never exported. | `newsletter_export` `{rows, status}` |

### SEO routes

| Route | Behaviour |
|---|---|
| `/sitemap.xml` (`sitemap.ts`, dynamic) | Empty when `seo.allow_indexing` is false. Otherwise lists `/`, `/balita`, `/botohan`, `/usap-bayan`, active categories (`/paksa/<slug>`), up to 5000 public articles (`lastModified` = `content_updated_at` or `published_at`), published pages that are not `robots_noindex`, and published or closed polls. On error it returns only `/`. |
| `/robots.txt` (`robots.ts`, dynamic) | `Disallow: /` when indexing is off. Otherwise allows `/`, disallows `/admin`, `/dashboard`, `/api/`, `/hanap` and `/newsletter/`, and links the sitemap. |
| `/rss.xml` (route) | RSS 2.0 feed of the latest 30 public articles. `?paksa=<slug>` gives a per-category feed. `Cache-Control: public, max-age=300`. Returns `503` text on error. |

## 6. Studio mutations: server actions, not a public API

Studio writes are Next.js server actions (`"use server"`). They are not a documented HTTP API.

Each action:

- Calls `requirePermission(...)` (all of the listed permissions) or `requireAnyPermission(...)` (any one of them). Both resolve the session from the database, never from client claims.
- Writes through the **session** client, so RLS, triggers and the definer RPCs enforce permissions a second time.
- Returns `{ok, data|error, message?}` (`ActionResult` in `src/lib/actions.ts`). Database exception names are mapped to safe messages there.

| File (`src/app/admin/...`) | Actions → permission |
|---|---|
| `(studio)/articles/actions.ts` | `createArticleFromEditor` (first save from the full New-article editor: inserts the draft as the caller, then runs `saveArticle` on it), `duplicateArticle` → `articles.create`. `saveArticle`, `restoreArticleRevision`, `searchArticlesForRelated` → any of `articles.edit_own` / `articles.edit_any`. `transitionArticle` → any of submit, review, publish, archive, edit_own, edit_any; the actual rules are in `transition_article`. `deleteArticle` → `articles.delete`, requires typing the exact title, and refuses public or scheduled articles. `createTag` → `taxonomy.manage`. |
| `(studio)/_media/actions.ts` | `uploadImage` (from the media picker) → `media.upload`. Images only (JPEG, PNG, WebP, GIF, AVIF), bytes sniffed by `storeUpload`; alt text required (≤300), caption ≤600, credit ≤200. Removes the stored object if the `media_assets` insert fails. Returns `{ok:true, media}` or `{ok:false, error}`. |
| `(studio)/ads/actions.ts` | `createAdSlot`, `updateAdSlot`, `toggleAdSlot`, `deleteAdSlot` → `ads.manage`. The creative must be an image asset; the destination must be `https://`. Each revalidates the whole public site. |
| `(studio)/applications/actions.ts` | `reviewApplication` → `users.manage`. One form with two buttons, Reject and Approve & invite. Approval sends the normal invitation through `inviteStaff` (Writer or Moderator only; no invitation or role change when the email is already staff), then calls `review_publisher_application` with the optional review note (up to 1000 characters). Rejection requires a reason (3–1000 characters). Both redirect to `/admin/applications?done=…`. |
| `(studio)/tips/actions.ts` | `reviewTip` → `tips.manage`. Status `reviewing`, `verified` or `dismissed` and an optional staff note (≤2000; required to dismiss, enforced by `review_tip`), plus the tip's `updated_at` from when the form was built. Server-redirects to the same tab with `?done=1`, or with `?changed=1` (nothing saved, the page shows a warning) when someone else saved the tip since the form was built; other errors are shown in the form. The tab value is checked against a fixed list before the address is built. |
| `(studio)/moderation/actions.ts` | `moderate`, `resolveReport` → `moderation.manage`. `resolveReport` sets a report to open, reviewing, resolved or dismissed with an optional resolution note. |
| `(studio)/newsletter/actions.ts` | `setSubscriberStatus` → `newsletter.manage` + `newsletter.view` |
| `(studio)/settings/actions.ts` | `saveSettings` → `settings.manage`. Editable keys: general, social, contact, footer, publication, community, newsletter. |
| `(studio)/taxonomy/actions.ts` | `saveCategory`, `createCategory` (the short form on the list page; same schema), `categoryOp`, `deleteCategory` (the typed value must equal the slug; refused while articles use the category), `saveTag`, `deleteTag` → `taxonomy.manage` |
| `(studio)/taxonomy/place-actions.ts` | `saveLocation`, `deleteLocation`, `saveTrending`, `trendingOp` → `taxonomy.manage` |
| `(studio)/team/actions.ts` | `inviteMember` → `users.manage`; uses `inviteStaff` (`src/lib/studio/invite.ts`), needs `SUPABASE_SERVICE_ROLE_KEY` for the invite, and the role is assigned as the inviter. `changeRole`, `setMemberActive` → `users.manage`. `updateMemberProfile` → any staff member for their own profile, `users.manage` for anyone else's. `saveRolePermissions` → `roles.manage`. |
| `apply/actions.ts` | `submitApplication` → no permission (public, signed out). Zod validation, honeypot (`website`; a filled honeypot gets the normal reply and nothing is stored), rate limit `application`, then the service-only `submit_publisher_application`. The reply is the same for new, duplicate and existing-staff emails. |
| `login/actions.ts` | `signIn`, `requestPasswordReset` → no permission; rate limit `login`. After a correct password `signIn` checks for an active profile with a role and signs the session out again when there is none. `signOut` ends the session on this device only. |
| `auth/update-password/actions.ts` | `updatePassword` → needs a session opened from an emailed link in the last 15 minutes (`isRecentLinkSession`); otherwise it redirects to `/admin/login?recovery=1&error=expired`. The password must be at least 12 characters with lower case, upper case and a digit (zod). On success it writes the audit row, ends every session and redirects to `/admin/login?notice=password-reset`. |

Removed on 2026-11-07 with their Studio modules (ADR-017): the homepage, media, navigation, pages, polls and SEO actions, `GET /admin/homepage/articles` and `GET /admin/polls/[id]/export`.

## 7. Inconsistencies noticed (not fixed)

- **Honeypot hits never get the "fake success" response.** `website: z.string().max(0)` rejects any non-empty value inside `readJson`, which returns `422` with zod's default message. The handlers' `if (parsed.data.website)` branches (newsletter, comments, community posts, vote) are therefore unreachable.
- **`POST /newsletter` reveals suppressed addresses.** It returns `status: "subscribed"` for suppressed addresses and `"recorded"` for every other address, even though the code comment says the response is identical so membership cannot be probed.
- **No rate limit** on `GET /polls/[id]/vote`, or any public GET except `/search`.
- **The envelopes differ.** Reads nest the payload under `data`, while writes spread fields at the top level. The `already_voted` response is `ok:false` without an `error` field. Studio JSON routes use neither envelope.
- **Tag creation in the editor is stricter than RLS.** `createTag` requires `taxonomy.manage`, but RLS `tags_writer_insert` lets any `articles.create` holder insert tags.
- **Unknown RSS category slugs are not reported.** A `?paksa=` slug that does not exist silently falls back to the site-wide feed.
