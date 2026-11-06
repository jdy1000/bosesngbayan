# Boses ng Bayan — Editorial workflow

Every article status change goes through one database function:
`transition_article(article_id, to, note, publish_at)`, defined in `supabase/migrations/…0200_content.sql`.

- Studio actions call it with the signed-in user's session, so it re-checks permissions itself.
- The scheduler calls it through `publish_due_articles()` in service context.
- No API writes `articles.status` directly. Update policies exclude the workflow columns.

## 1. States

`draft → pending_review → approved → published | scheduled → archived`, plus `rejected`.

| State | Meaning | Publicly visible |
| --- | --- | --- |
| `draft` | Being written | No |
| `pending_review` | Submitted for editorial review | No |
| `approved` | Passed review, not yet published | No |
| `rejected` | Returned with a required reason | No |
| `scheduled` | Approved, with a future `published_at` | Becomes visible once `published_at ≤ now()` (`article_is_public`) |
| `published` | Live | Yes |
| `archived` | Withdrawn from public lists | No |

## 2. Allowed transitions

Permissions are those in `role_permissions` (see `ADMIN_RBAC.md`). "Author" means `articles.author_id = auth.uid()`.

| From → To | Who |
| --- | --- |
| draft / rejected → pending_review | `articles.submit` **and** (author **or** `articles.edit_any`) |
| pending_review → draft (withdraw) | the author with `articles.submit`, or `articles.review` |
| rejected → draft | author or `articles.edit_any` |
| pending_review → approved / rejected | `articles.review` |
| approved / draft → published / scheduled | `articles.publish` (a direct draft → publish records the publisher as approver too) |
| approved → draft | `articles.review` or `articles.publish` |
| scheduled → published / draft | scheduler (service) or `articles.publish` |
| published → draft (unpublish) | `articles.publish` |
| any (except archived) → archived | `articles.archive` |
| archived → draft (restore) | `articles.archive` |

Anything else raises `transition_not_allowed`, as does a transition to the same state.

## 3. Guards

These raise errors that Studio shows as plain Filipino messages:

- **Rejecting** requires a non-empty reason (`rejection_reason_required`).
- **Submitting, publishing or scheduling** requires a category (`category_required`) and body text (`body_required`).
- **Scheduling** requires a future `publish_at` (`schedule_must_be_future`). Studio converts the Asia/Manila datetime input to UTC with `manilaLocalToIso`.
- The row is locked (`for update`) during the transition, so concurrent transitions serialise.

## 4. What gets recorded

| Field | Set when |
| --- | --- |
| `submitted_at` | → pending_review (a previous rejection reason is cleared) |
| `reviewed_at`, `reviewed_by` | → approved / rejected |
| `review_note` | approval note |
| `rejection_reason` | rejection |
| `approved_at`, `approved_by` | → approved, or a direct draft → publish / schedule |
| `published_at` | the public publication time; for scheduling, the scheduled time |
| `first_published_at` | the first time it went live; kept across unpublish and republish |
| `published_by` | → published / scheduled |
| `archived_at` | → archived; cleared on restore |
| `updated_at` | every edit (trigger). Public pages show "Na-update" only when it differs from `published_at` |

- Every transition writes a `content_activity_logs` row (actor, from, to, note). The actor is `scheduler` for automatic publishing.
- Submitting, scheduling and publishing take an `article_revisions` snapshot. Editors also get autosave and manual revisions from Studio, and can restore earlier revisions.
- Author attribution (`author_id`) and contributors are never changed by a transition.
- Ordinary content saves (autosave or manual) are **not** written to `content_activity_logs`, because `write_activity` is not callable by signed-in users. History shows transitions plus revisions. A manual save creates a revision; autosave does not.
- Revision snapshots hold title, subtitle, slug, excerpt, body, category, location, featured image, SEO title and description, canonical URL, source attribution, correction note and tags. They do **not** hold the OG image, homepage flags, author, contributors or related articles, so restoring a revision cannot bring those back.
- Saves are conditional on the `updated_at` the editor loaded. A concurrent save by someone else produces a conflict notice instead of a silent overwrite.

## 5. Scheduled publishing

See `ARCHITECTURE.md` ADR-008.

- Visibility uses `article_is_public(status, published_at)`: `published`, or `scheduled` with `published_at ≤ now()`. A scheduled story therefore appears on time without any job.
- `/api/cron/publish` (Bearer `CRON_SECRET`) runs `publish_due_articles()` to flip the stored status and revalidate pages.
- **Timezone:** stored as `timestamptz` (UTC) and displayed in Asia/Manila (UTC+8, no DST).

## 6. Public and preview boundaries

- Public queries (`src/lib/cms/articles.ts`, the public API) go through RLS with the anon role, so drafts, pending, approved-but-unpublished, rejected and archived articles are never returned.
- Previews live at `/admin/preview/articles/[id]`. They need a staff session with permission to read the article, use the session client, and send `noindex` and `no-store`. A preview URL is useless to a signed-out visitor.
- After a publish or unpublish, Studio revalidates `/`, `/balita`, the article path and the category path.

## 7. Edge cases

- **Editing a published article:** a user with `articles.edit_any`, or the author of their own article, keeps it live. The edit is revisioned. Writers cannot edit after publication unless they also hold `articles.edit_any`.
- **Unpublish, then republish:** `first_published_at` is kept, so the original publication date stays truthful.
- **Category deleted while articles reference it:** blocked by a foreign key `on delete restrict`; Studio shows a dependency message.
- **Author deactivated:** their articles keep attribution. Editors can still move them through the workflow.
- **Correction:** set the article's correction note. It renders above the body with the update time.
