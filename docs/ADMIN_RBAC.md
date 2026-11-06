# Boses ng Bayan — Roles and permissions (RBAC)

The source of truth is `supabase/migrations/20261106000100_core_rbac.sql`. It defines the `permissions` and `role_permissions` tables and these helpers:

- `has_permission()`, `is_staff()`, `auth_app_role()`
- the team RPCs `set_user_role()`, `set_user_active()` and `set_role_permission()`

Each user has at most one role (`user_roles.user_id` is the primary key). An inactive profile has no permissions.

## 1. Default matrix

The defaults below are seeded by the migration. Owners can change the matrix for non-owner roles in **Studio → Team at Roles**, using `set_role_permission`, which requires `roles.manage`.

| Permission | Description | Owner | Admin | Editor | Writer | Moderator | Analyst |
| --- | --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `dashboard.view` | Open Studio and view the dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `articles.create` | Create new articles | ✓ | ✓ | ✓ | ✓ | — | — |
| `articles.edit_own` | Edit own articles while in draft or rejected | ✓ | ✓ | ✓ | ✓ | — | — |
| `articles.edit_any` | Edit any article in any editable state | ✓ | ✓ | ✓ | — | — | — |
| `articles.view_all` | View all articles regardless of author | ✓ | ✓ | ✓ | — | — | — |
| `articles.submit` | Submit articles for editorial review | ✓ | ✓ | ✓ | ✓ | — | — |
| `articles.review` | Approve or reject submitted articles | ✓ | ✓ | ✓ | — | — | — |
| `articles.publish` | Publish, schedule and unpublish articles; set homepage flags | ✓ | ✓ | ✓ | — | — | — |
| `articles.archive` | Archive and restore articles | ✓ | ✓ | ✓ | — | — | — |
| `articles.delete` | Permanently delete articles | ✓ | ✓ | — | — | — | — |
| `media.upload` | Upload media and edit own media | ✓ | ✓ | ✓ | ✓ | — | — |
| `media.manage_any` | Edit and delete any media asset | ✓ | ✓ | ✓ | — | — | — |
| `taxonomy.manage` | Manage categories, tags, locations and trending topics | ✓ | ✓ | ✓ | — | — | — |
| `pages.manage` | Create, edit and publish static pages | ✓ | ✓ | ✓ | — | — | — |
| `homepage.manage` | Edit and publish homepage configuration | ✓ | ✓ | ✓ | — | — | — |
| `navigation.manage` | Edit header and footer navigation | ✓ | ✓ | — | — | — | — |
| `polls.manage` | Create, edit, publish, close and archive polls | ✓ | ✓ | ✓ | — | — | — |
| `polls.view_results` | View poll results and export them | ✓ | ✓ | ✓ | — | — | ✓ |
| `moderation.manage` | Moderate submissions, comments and reports | ✓ | ✓ | ✓ | — | ✓ | — |
| `newsletter.view` | View subscribers | ✓ | ✓ | — | — | — | — |
| `newsletter.manage` | Suppress, unsubscribe and export subscribers | ✓ | ✓ | — | — | — | — |
| `analytics.view` | View analytics dashboards | ✓ | ✓ | ✓ | — | — | ✓ |
| `users.view` | View team members and roles | ✓ | ✓ | ✓ | — | — | — |
| `users.manage` | Invite, change roles and deactivate team members | ✓ | ✓ | — | — | — | — |
| `settings.manage` | Edit site settings | ✓ | ✓ | — | — | — | — |
| `seo.manage` | Manage redirects and global SEO defaults | ✓ | ✓ | — | — | — | — |
| `audit.view` | View audit logs | ✓ | ✓ | — | — | — | — |
| `roles.manage` | Edit the role permission matrix (owner only) | ✓ | — | — | — | — | — |

The role intent follows the master spec §5:

- **Writers** draft and submit but cannot publish.
- **Editors** run the newsroom: review, publish, homepage, polls, pages, taxonomy, media and moderation. They do not have team, settings, SEO or navigation rights.
- **Moderators** handle only the community queues.
- **Analysts** have read-only dashboards and poll results.

## 2. Protected invariants (enforced in SQL, not the UI)

| Rule | Where |
| --- | --- |
| Only an Owner can grant the `owner` role, or change an Owner's role | `set_user_role` → `owner_role_protected` |
| Nobody can change their own role | `set_user_role` → `cannot_change_own_role` |
| There is always at least one active Owner | `set_user_role` / `set_user_active` → `at_least_one_owner_required` |
| Owner permissions cannot be edited, and `roles.manage` cannot be granted to other roles | `set_role_permission` → `owner_permissions_locked`, `roles_manage_owner_only` |
| `profiles.is_active` changes only through `set_user_active` (`users.manage`) | profile guard trigger |
| Writers edit their own articles only in `draft` / `rejected` | `articles_update` RLS policy (`articles.edit_own`) |
| Workflow columns (status, publish timestamps, reviewer fields) change only through `transition_article` | `articles_guard` trigger |
| Media: upload into your own `<uid>/` folder; edit or delete others' files only with `media.manage_any` | storage policies (`…0400_storage.sql`) and `media_assets` RLS |
| Every role change, deactivation, permission change and owner bootstrap is audited | `write_audit` calls inside the RPCs |

Administrators hold `users.manage`, so they can invite, deactivate and assign non-owner roles. They cannot touch Owners or the permission matrix.

## 3. Studio routes and gates

Each Studio page calls `requireStaffPage(permission)` on the server, and each server action calls `requirePermission(permission)` again. The sidebar (`src/components/studio/nav.ts`) only hides links the user cannot use.

`/admin/account` (Aking Account) is open to every signed-in staff member and acts only on the caller's own auth user: change email (Supabase sends a confirmation link to both the old and the new address) and change password (the current password is re-verified first). Both actions are rate-limited and audited (`account_email_change_requested`, `account_password_changed`). The top-bar bell counts pending work only for queues the member can act on (`articles.review`, `moderation.manage`), through their own session so RLS applies.

| Route | Visible with any of |
| --- | --- |
| `/admin` | `dashboard.view` |
| `/admin/articles` | `articles.create`, `articles.view_all` |
| `/admin/media` | `media.upload`, `media.manage_any` |
| `/admin/taxonomy` | `taxonomy.manage` |
| `/admin/pages` | `pages.manage` |
| `/admin/homepage` | `homepage.manage` |
| `/admin/navigation` | `navigation.manage` |
| `/admin/seo` | `seo.manage` |
| `/admin/settings` | `settings.manage` |
| `/admin/polls` | `polls.manage`, `polls.view_results` |
| `/admin/moderation` | `moderation.manage` |
| `/admin/newsletter` | `newsletter.view`, `newsletter.manage` |
| `/admin/analytics` | `analytics.view` |
| `/admin/team` | `users.view`, `users.manage` |
| `/admin/audit` | `audit.view` |
| `/admin/preview/*` | staff session plus read access to that draft (RLS); homepage preview requires `homepage.manage` |

## 4. Tests

`tests/db/*.test.ts` covers both allowed and denied operations per role in PGlite. Examples:

- a writer cannot publish or edit another writer's draft;
- analysts and moderators cannot create articles, and writers cannot moderate;
- writers cannot create polls or set homepage placement flags;
- an administrator cannot promote to Owner;
- an administrator cannot deactivate the Owner, and deactivated staff lose all permissions at once;
- only the Owner can edit the permission matrix;
- anonymous users read only published rows.
