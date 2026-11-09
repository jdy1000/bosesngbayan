# Boses ng Bayan — Master Product, Design & Engineering Specification

**Document type:** Authoritative build specification for Claude Code  
**Product:** Boses ng Bayan  
**Product tagline:** May boses ka. May saysay ang opinyon mo.  
**Primary language:** Filipino, with support for English and natural Taglish  
**Initial timezone:** Asia/Manila  
**Status:** Build specification; implementation status must be tracked separately in `progress.txt`.

---

## 0. How to use this specification

This document is the source of truth for the Boses ng Bayan product. Claude Code must consult it before implementing features, when diagnosing defects, after failed tests, and before declaring work complete.

The supplied Boses ng Bayan landing-page screenshot is the **primary visual source of truth** for the public website. Inspect the actual image in the repository or the supplied attachment before implementing the design. Reconstruct its hierarchy and composition rather than inventing an unrelated template.

This project is **not** a static landing-page exercise. It is a complete Filipino news, public-opinion, and community platform with:

1. A public-facing editorial/news website.
2. A private administration console called **Boses ng Bayan Studio**.
3. A headless CMS and content-delivery layer.
4. Secure roles and permissions.
5. Editorial review and publishing workflows.
6. Polling and community moderation.
7. Media, newsletter, analytics, SEO, site settings, and audit capabilities.

### Rules for interpreting requirements

- Requirements in this document are acceptance criteria, not decorative suggestions.
- Preserve working code and inspect the repository before choosing or changing the stack.
- Do not claim a feature is complete because its screen exists. It must persist data, enforce permissions, handle errors, and pass relevant tests.
- Where an integration requires unavailable credentials, build a safe, typed integration boundary and document the exact configuration needed. Do not pretend the integration is live.
- Do not invent real-world news, sources, statistics, poll results, analytics, author identities, or subscriber counts. Use clearly labelled seed/demo content only in development. *(Owner decision 2026-11-06: local preview content carries no visible labels; see ADR-013 for the replacement safeguards: local-only seed, generic content, no-attribution photos.)*
- Do not publish user-submitted content automatically. Community content must pass moderation when moderation is enabled.
- Do not represent voluntary online poll results as statistically representative of the Philippine population.

---

# 1. Product vision

Boses ng Bayan is a modern Filipino digital news and community-engagement platform where people can discover important stories, understand issues affecting their communities, participate in public-opinion polls, share perspectives, and stay informed.

The intended experience combines:

- A modern digital newspaper.
- A Philippine news publication.
- An approachable community platform.
- An interactive public-opinion and polling platform.
- A manageable digital newsroom for a growing editorial team.

### Target audience

- Everyday Filipino readers.
- Young professionals and students.
- Local community members.
- News readers and opinion contributors.
- Editors, writers, journalists, and moderators.

### Product principles

1. **Accessible:** clear language, legible typography, responsive layouts, and usable controls.
2. **Credible:** transparent authorship, dates, corrections, sources, and poll methodology.
3. **Community-oriented:** encourage participation without allowing abuse or unmoderated publishing.
4. **Editorially useful:** make daily newsroom work efficient and auditable.
5. **Owner-operable:** everyday publishing and homepage management should not require a developer.
6. **Secure by default:** authorization and data protection must be enforced server-side and at the database/storage layer.

---

# 2. Reference design and visual reverse engineering

## 2.1 Primary reference

The supplied Boses ng Bayan screenshot is the main design reference. Inspect it and document the design system before implementing the public pages.

Analyze:

- Overall composition and content width.
- Header, logo, and navigation proportions.
- Typography hierarchy and headline wrapping.
- Color palette and contrast.
- Hero image crop and composition.
- Poll-card placement and styling.
- Topic/trending strip.
- Article card dimensions and spacing.
- Section backgrounds and separators.
- CTA composition.
- Newsletter and footer layout.
- Tablet/mobile adaptations.

Recreate the visual identity, hierarchy, section structure, and overall experience as closely as reasonably possible. Do not merely use the screenshot as loose inspiration.

## 2.2 Design direction

> **Updated 2026-11-06:** the editorial serif was replaced by one sans family (Inter) for headlines and body, following the owner-chosen Morning/Istorya references. Colours below are unchanged. `docs/DESIGN_SYSTEM.md` is the current source.

Use:

- Primary: cobalt / royal blue.
- Secondary: deep navy.
- Accent: Philippine-inspired red.
- Base: white with subtle cool-gray surfaces.
- Supporting surfaces: pale blue and restrained blue gradients.
- Editorial serif typography for major headlines.
- Modern sans-serif typography for navigation, body copy, labels, and controls.
- High-quality editorial/community photography.
- Soft shadows, restrained borders, rounded interactive components, and generous whitespace.

Avoid:

- Generic SaaS aesthetics on the public website.
- Excessive gradients, glassmorphism, or animation.
- Emoji-based navigation icons.
- Random decorative elements that compete with stories.
- Tiny unreadable text.
- Unrelated branding or generic template layouts.

The admin console may be more productivity-oriented and information-dense, but should retain Boses ng Bayan's identity and use consistent components.

## 2.3 Responsive requirements

Validate large desktop, standard desktop, laptop, tablet, mobile, and small mobile.

Do not simply shrink desktop layouts. Recompose navigation, hero, cards, article layouts, poll controls, and grids appropriately for smaller screens. Avoid horizontal overflow and inaccessible touch targets.

## 2.4 Design-system deliverables

Document in `docs/DESIGN_SYSTEM.md`:

- Design tokens.
- Typography choices and scale.
- Colors and contrast rules.
- Spacing scale.
- Container widths and breakpoints.
- Buttons, links, forms, badges, cards, tables, and modal patterns.
- Loading, empty, error, and success states.
- Responsive behavior.
- Image treatment and aspect ratios.

---

# 3. Public website information architecture

Build a complete public editorial website. The public site must read published content from the CMS, not from hardcoded frontend arrays.

## 3.1 Global header and navigation

Include:

- Boses ng Bayan logo.
- Bahay.
- Mga Balita.
- Usap Bayan.
- Mga Paksa.
- Tungkol.
- Search.
- Sumali sa Botohan CTA.

Navigation must be editable in the admin console. Build responsive mobile navigation with functional destinations and a working menu. Support dropdown groups if configured by the CMS.

## 3.2 Trending topics bar

Initial topic examples:

- Transportasyon.
- Edukasyon.
- Kalusugan.
- Trabaho.
- Ekonomiya.
- Pulitika.
- Komunidad.

Requirements:

- Topics are managed by the CMS.
- Each topic links to a filtered topic/category destination.
- Editors can enable/disable topics and control ordering.
- Trending indicators must be based on an explainable source or editorial configuration, not fabricated activity.

## 3.3 Homepage hero

> **Product decision (2026-11-06, owner request):** Boses ng Bayan is a news website first, not a voting website. The default homepage now opens with a `top_stories` block (lead story, right rail, story row) styled after the Morning template (morning-template.webflow.io) and structured like Istorya (istorya.news). The poll moves down to a "Botohan ng Araw" module. The poll hero described below still exists as the CMS block `hero` and can be re-enabled from the homepage builder, but it is no longer part of the starter layout. See ADR-012 in `docs/ARCHITECTURE.md`.

Recreate the supplied screenshot composition.

Left side:

- Small editorial label.
- Headline: **“May boses ka. May saysay ang opinyon mo.”**
- Supporting description.
- Primary CTA: **“Bumoto ngayon.”**
- Secondary CTA: **“Tingnan ang resulta.”**
- Community/trust microcopy.

Right side:

- Strong Filipino community photograph.
- Featured poll card overlay.
- Poll question and answer options.
- Results when permitted by poll configuration.
- Vote CTA.

Every hero field—including media, copy, CTA labels/targets, and featured poll—must be editable from the CMS. No hardcoded hero content in the public frontend.

## 3.4 News and featured-story sections

Support configurable sections for:

1. Mga Balita.
2. Breaking News.
3. Featured Stories.
4. Latest Stories.
5. Trending News.
6. Editor's Picks.
7. Most Read.
8. Popular This Week.
9. Category-based stories.
10. Recommended Stories.

Each story card may display:

- Featured image.
- Category.
- Headline.
- Short description/excerpt.
- Author.
- Publication date.
- Reading time.
- Optional featured/breaking label.
- Article link.

Use real content queries. Include pagination or load-more behavior where appropriate. Provide meaningful empty states when no content exists.

## 3.5 Categories and archives

Suggested initial categories:

- Pilipinas.
- Pulitika.
- Business.
- Ekonomiya.
- Edukasyon.
- Kalusugan.
- Teknolohiya.
- Transportasyon.
- Trabaho.
- Entertainment.
- Sports.
- Lifestyle.
- Opinion.
- Komunidad.
- Exposed.

These are seed suggestions, not immutable frontend constants. Authorized CMS users can create, edit, reorder, disable, and delete categories subject to content dependencies.

Build category archive pages with descriptive metadata, pagination, and relevant stories.

## 3.6 Individual article page

Route pattern: `/balita/[slug]`.

Include:

- Breadcrumbs.
- Category label.
- Headline and subtitle.
- Author and contributor details.
- Publication and updated dates.
- Reading time.
- Featured image, caption, alt text, and credit.
- Rich-text article body.
- Embedded images and supported video embeds.
- Pull quotes.
- Lists and tables.
- Related and recommended stories.
- Share controls.
- Newsletter CTA.
- Comments/discussion only when enabled and appropriately moderated.

Implement per-article SEO, Open Graph, canonical URL, and social metadata. Clearly distinguish original publication time from update time.

## 3.7 Usap Bayan: opinion and community

Create:

- Featured discussion topics.
- Public opinion discussions.
- User-submitted perspectives.
- Community questions.
- Discussion cards.
- Moderated comments.
- Report controls.

Community submissions must pass the configured moderation process before appearing publicly. Provide report reasons, moderation states, and audit history.

## 3.8 Polling and voting

Polling is a core functional feature, not a decorative hero element.

Public capabilities:

- Active polls and featured poll.
- Poll detail page.
- Single-choice and multiple-choice formats.
- Vote submission.
- Vote validation.
- Results display according to poll settings.
- Total vote count.
- Opening/closing status.
- Previous polls and archive.
- Poll methodology and participation caveat.

Admin capabilities:

- Create, edit, preview, publish, unpublish, feature, close, and archive polls.
- Add, edit, reorder, and remove answer options subject to vote-integrity rules.
- Configure open/close dates and result visibility.
- View results and export CSV.

*(Owner decision 2026-11-07: the Studio poll admin (`/admin/polls`, including the CSV export) was removed at the owner's request. Existing polls stay public and voting still works, but polls can no longer be created, edited, closed or archived from Studio. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

Security and integrity:

- Validate votes server-side.
- Prevent duplicate voting according to the selected voting policy.
- Use rate limiting and abuse controls.
- Do not trust totals or permissions calculated in the browser.
- Protect voter data and avoid collecting unnecessary identifying information.
- Define how anonymous or authenticated participation works per poll.
- Do not silently change poll options after votes exist; preserve integrity through explicit rules and audit records.
- Display that voluntary online polls are not necessarily representative of the Philippine population.

## 3.9 Regional news discovery

Support Luzon, Visayas, and Mindanao, with region/province/place taxonomies managed through the CMS. Readers can filter stories by region and location. Do not invent geographic statistics or article counts.

## 3.10 Additional editorial modules

Support configurable modules such as:

- Photo of the Day.
- Quote of the Day.
- Today in History.
- Did You Know?
- Poll of the Day.
- News Quiz.
- Explainers.
- Topic Hubs.

Each module must be CMS-managed and optionally enabled on the homepage. Avoid presenting unverified historical or factual content as authoritative.

## 3.11 Newsletter

Build working subscription functionality:

- Email subscription.
- Consent checkbox and recorded consent state/time.
- Email validation.
- Duplicate-subscription handling.
- Subscriber persistence.
- Unsubscribe/suppression functionality.
- Subscription status and date.
- CSV export.
- Admin subscriber management.

Integrate an email service only through environment-based configuration. Do not claim a campaign or confirmation email was sent unless a configured provider confirms success. Respect privacy and applicable consent requirements.

## 3.12 Footer

Include editable:

- Branding.
- About and Contact links.
- Editorial Policy.
- Privacy Policy.
- Terms of Service.
- Category links.
- Social links.
- Newsletter subscription.
- Copyright information.

All footer links and text should come from CMS-managed settings/navigation where appropriate.

---

# 4. Admin console — Boses ng Bayan Studio

Create a protected private administration experience.

Routes:

- `/admin/login`
- `/admin` (dashboard)

The console must function as a newsroom management system, not a set of decorative forms. Use clean, information-dense layouts, clear statuses, search/filter controls, useful tables, and strong empty/loading/error states.

*(Owner decision 2026-11-07: the Studio console follows the team's Newsmaker admin (ADR-016). At the owner's request these Studio modules were removed: Pages (§4.6), Media Library (§4.4), Homepage Builder (§4.5), Navigation (§4.13), SEO & redirects (§4.14), Poll management (§4.8) and the audit-log viewer. Analytics and Settings were kept. Audit rows are still written and can be read with SQL. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.1 Admin dashboard

Show actual database-backed metrics where tracked:

- Total articles.
- Published articles.
- Draft articles.
- Pending review.
- Scheduled articles.
- Articles published today.
- Page views.
- Poll votes.
- Active polls.
- Newsletter subscribers.
- Active writers.
- Recent editorial activity.
- Top-performing stories.
- Most-read categories.
- Traffic trends.
- Publication activity.

Date filters: today, last 7 days, last 30 days, last 90 days, and custom range.

Metrics must use actual events and stored records. Never fabricate metrics to populate charts. Show empty states and metric definitions when data is unavailable. Distinguish delayed/aggregated data from real-time data.

## 4.2 Article management

Article list fields:

- Thumbnail.
- Title.
- Category.
- Author.
- Status.
- Publication/scheduled date.
- Last modified.
- Views, if actually tracked.
- Actions.

Filters: draft, pending review, approved, published, scheduled, archived, rejected.

Support search by title, author, slug, and category; sorting; pagination; and bulk actions only where safe.

Actions:

- Create.
- Edit.
- Preview.
- Duplicate.
- Submit for review.
- Approve.
- Reject with reason.
- Publish.
- Schedule.
- Unpublish.
- Archive.
- Restore.
- Delete with explicit confirmation and dependency checks.

## 4.3 Article editor

Fields:

- Title.
- Subtitle.
- Slug.
- Excerpt.
- Rich-text body.
- Featured image.
- Caption, credit, and alt text.
- Category and tags.
- Author and contributors.
- Editorial status.
- Featured/breaking flags.
- Homepage placement.
- Publication and scheduled dates.
- SEO title and description.
- Canonical URL.
- Open Graph image.
- Related articles.
- Source attribution.
- Correction notes.

Use a maintained rich-text editor such as TipTap or an equivalent. Support headings, paragraphs, emphasis, links, lists, blockquotes, images/captions, supported embeds, tables, and separators. Sanitize rich-text output and prevent stored XSS.

Provide autosave with visible status, preview, and revision history. Publishing must be an explicit authorized action. Preserve authorship and editorial history.

## 4.4 Headless media library

Features:

- Image uploads and supported file references.
- Video/external media references where appropriate.
- Metadata and search.
- Folder/category organization.
- Preview.
- Rename/replace/delete.
- Usage references.
- Alt text, caption, credit.
- Upload date and uploader.

Use the existing configured storage solution, preferably Supabase Storage for a new Supabase-based project. Implement file type/size checks, secure upload authorization, owner-aware storage policies, and permission-aware deletion. Optimize public delivery and responsive image sizes. Do not expose private media through public URLs unintentionally.

*(Owner decision 2026-11-07: the Studio media library (`/admin/media`) was removed at the owner's request. Images are uploaded from the media picker instead, with alt text, caption and credit set at upload time (ADR-016). Existing media can no longer be edited, replaced or deleted from Studio. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.5 Homepage builder

The owner/editor must manage the homepage without source-code edits.

Capabilities:

- Add/edit/remove homepage sections.
- Reorder sections.
- Enable/disable sections.
- Configure titles and descriptions.
- Choose content sources and featured items.
- Configure category filters and item limits.
- Configure hero copy, image, CTA, and featured poll.
- Preview draft configuration.
- Publish configuration.

Supported block types:

1. Hero.
2. Trending topics.
3. Breaking news.
4. Featured story.
5. Latest articles.
6. Article grid.
7. Category showcase.
8. Editor's picks.
9. Most-read articles.
10. Poll showcase.
11. Community section.
12. Regional news.
13. Newsletter.
14. Custom CTA.
15. Photo of the Day.
16. Quote of the Day.
17. News quiz.

Use a typed, validated block schema. JSON configuration is appropriate for flexible section settings, but do not put unrelated relational data into one giant JSON column. The public frontend renders only published homepage configuration and its permitted content.

*(Owner decision 2026-11-07: the Studio homepage builder (`/admin/homepage` and its draft preview) was removed at the owner's request. The homepage layout can no longer be changed from Studio; the public site renders the stored published configuration. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.6 Pages management

Support create, edit, slug change, rich content, SEO metadata, preview, publish, unpublish, archive, and revision history.

Initial pages may include About, Contact, Editorial Policy, Privacy Policy, Terms of Service, and Advertise With Us.

*(Owner decision 2026-11-07: the Studio pages module (`/admin/pages` and its preview) was removed at the owner's request. Pages can no longer be created, edited or published from Studio; published pages stay public. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.7 Category and tag management

Support create/edit/delete, slug, description, image, SEO data, featured state, and ordering. Prevent accidental deletion where content dependencies exist. Tags should have a clear relationship with articles and should not be confused with categories.

## 4.8 Poll management

Provide a dedicated poll dashboard with poll list, create/edit, options, opening/closing dates, result visibility, publish state, featured placement, results breakdown, CSV export, and audit history.

*(Owner decision 2026-11-07: the Studio poll dashboard (`/admin/polls`) was removed at the owner's request. Existing polls stay public and voting still works. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.9 Community moderation

Provide moderation queues for submissions, comments, and reports. Include report reasons, status, search, filters, approve/reject/hide/remove/flag actions, moderator notes, and moderation history. Restrict actions by permission.

## 4.10 User and team management

Support secure invitations, role assignment, permission review, account deactivation, access revocation, and activity review. Account creation must not be exposed as unrestricted public admin registration. Use secure authentication flows for recovery.

*(Owner decision 2026-11-07: people can ask to join the newsroom through the public form at `/admin/apply`. An application creates no account and grants no access; only an administrator's approval sends the normal invitation. See ADR-018 in `docs/ARCHITECTURE.md`.)*

## 4.11 Newsletter management

Support subscriber search/filter, subscription status, consent review, subscription date, suppression/unsubscribe, CSV export, and provider integration status. Campaign sending is optional and must require configured credentials and explicit authorization.

## 4.12 Analytics and monitoring

Track only metrics that are actually implemented:

- Page/article views.
- Unique visitors where a privacy-compliant method is configured.
- Reading engagement where measurable.
- Popular articles.
- Category engagement.
- Poll participation.
- Newsletter subscriptions.
- Traffic trends.
- Referring sources where available.
- Content performance.

Define metric calculations, event deduplication strategy, bot filtering where practical, date ranges, and data retention. Do not label delayed data as real-time.

## 4.13 Navigation management

Allow authorized users to add/edit/reorder/hide/show navigation items, destinations, dropdown groups, and footer links. Public navigation must be database-driven.

*(Owner decision 2026-11-07: the Studio navigation module (`/admin/navigation`) was removed at the owner's request. Header and footer navigation can no longer be edited from Studio. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.14 SEO management

Support global templates and page/article/category-level:

- Title and description.
- Canonical URL.
- Open Graph metadata/image.
- Social metadata.
- Robots directives.
- XML sitemap.
- RSS feeds.
- Redirect management.

Generate safe defaults from content when custom metadata is missing. Validate redirect targets and prevent open redirects.

*(Owner decision 2026-11-07: the Studio SEO & redirects module (`/admin/seo`) was removed at the owner's request. Global SEO defaults and redirects can no longer be edited from Studio. Article and category SEO fields are still edited in their own forms. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## 4.15 Site settings

Manage site name, logo, favicon, brand colors, social links, contact information, global SEO, footer, homepage defaults, default author, publication settings, timezone, and language settings. Sensitive secrets must never be managed as ordinary public CMS text fields.

---

# 5. Roles and server-enforced permissions

Implement real role-based access control (RBAC), with granular permissions where practical.

## OWNER

Full platform access, including team management, protected security settings, all content, publishing, analytics, audit logs, and system configuration. Ownership transfer and recovery must require additional safeguards and must not be available to ordinary admins.

## ADMINISTRATOR

Administrative access to explicitly granted operational functions. May manage content, configuration, and users only where permissions authorize it. Cannot transfer ownership or change protected owner-level controls.

## EDITOR

May create/edit stories, review submissions, approve, publish, schedule, manage categories/tags, homepage placement, polls, pages, media, and moderation where authorized. Cannot change owner privileges or protected security configuration.

## WRITER

May create stories, edit own drafts, upload permitted media, submit for review, and inspect own editorial history. Cannot publish unless the corresponding permission is explicitly granted.

## MODERATOR

May review comments and user submissions, process reports, approve/reject community content, and record moderation actions. Cannot access protected owner settings.

## ANALYST

Read-only access to authorized dashboards and analytics.

### Permission requirements

- Enforce permissions in server-side actions/API handlers and database/storage policies.
- Never trust client-provided role names or permission flags.
- Do not rely on hiding sidebar entries or disabling buttons.
- Validate each state transition and resource ownership.
- Add tests for both allowed and denied operations.
- Log sensitive administrative operations.
- Provide a permission matrix in `docs/ADMIN_RBAC.md`.

---

# 6. Editorial workflow and state transitions

Expected workflow:

`Writer creates draft → Saves draft → Submits for review → Editor reviews → Approves or rejects with reason → Approved content is scheduled or published → Public website displays published content → Analytics record engagement → Editor updates, unpublishes, or archives content as authorized.`

Requirements:

- Preserve author attribution.
- Record created/updated/submitted/reviewed/approved/published timestamps as appropriate.
- Record who approved and who published.
- Maintain revision history.
- Record rejection reason and reviewer notes.
- Prevent unauthorized or invalid state transitions.
- Support scheduled publishing using a reliable server-side scheduler or deployment-compatible scheduled mechanism.
- Make timezone conversion explicit and use Asia/Manila as the initial site timezone.
- Public queries must exclude drafts, pending reviews, rejected, and archived content.
- Draft preview must use protected preview authorization and must not leak through normal public endpoints or caches.

Document state transitions and edge cases in `docs/EDITORIAL_WORKFLOW.md`.

---

# 7. Headless CMS and API architecture

The backend/content layer must be independent of presentation components. The public website must consume content through a typed data-access/API boundary rather than importing mock arrays or hardcoded content.

Suggested public API routes (adapt to the chosen framework while preserving contracts):

- `GET /api/public/v1/articles`
- `GET /api/public/v1/articles/[slug]`
- `GET /api/public/v1/categories`
- `GET /api/public/v1/categories/[slug]`
- `GET /api/public/v1/polls`
- `GET /api/public/v1/polls/[slug]`
- `POST /api/public/v1/polls/[id]/vote`
- `GET /api/public/v1/homepage`
- `GET /api/public/v1/pages/[slug]`
- `GET /api/public/v1/trending`
- `GET /api/public/v1/search`

Protected editorial operations should cover articles, pages, categories, tags, polls, media, navigation, homepage sections, users, moderation, analytics, and settings.

Requirements:

- Request and response validation.
- Typed response contracts.
- Pagination, filtering, and sorting.
- Server-side authorization.
- Consistent safe errors.
- Published-content filtering.
- Protected preview functionality.
- Cache invalidation/revalidation after authorized publishing changes.
- API documentation.
- No privileged credentials in client bundles.

The route examples are suggested interfaces, not a reason to create an unnecessarily large set of thin endpoints. Prefer coherent service boundaries and framework-native patterns.

---

# 8. Database architecture

Use a normalized relational database. For a new project, the default recommendation is Supabase PostgreSQL. If the existing repository already has a suitable database architecture, assess it before changing anything.

Create version-controlled migrations, appropriate indexes, foreign keys, constraints, delete behavior, timestamps, and Row Level Security policies where applicable.

At minimum, evaluate schema support for:

- `profiles`
- `user_roles`
- `role_permissions`
- `articles`
- `article_revisions`
- `article_contributors`
- `categories`
- `tags`
- `article_tags`
- `media_assets`
- `pages`
- `page_revisions`
- `homepage_configurations`
- `homepage_sections`
- `navigation_menus`
- `navigation_items`
- `polls`
- `poll_options`
- `poll_votes`
- `community_posts`
- `comments`
- `moderation_reports`
- `newsletter_subscribers`
- `page_view_events`
- `content_activity_logs`
- `audit_logs`
- `site_settings`
- `redirects`

Add or remove tables based on actual design justification. Avoid giant JSON columns for unrelated data. Use JSON configuration where it genuinely supports typed flexible page composition. Include migration and rollback considerations where supported.

Document the actual schema and relationships in `docs/DATABASE_SCHEMA.md`.

---

# 9. Security, privacy, and trust

Treat this as a real publishing platform.

Mandatory security expectations:

1. Secure authentication and session handling.
2. Server-enforced RBAC.
3. Database-level access control and RLS where applicable.
4. Protected admin routes and operations.
5. No public admin registration.
6. Secure initial owner creation/bootstrap process.
7. Environment variables for secrets.
8. Secure upload validation and authorization.
9. Owner-aware and permission-aware storage policies.
10. Input validation with schemas such as Zod.
11. Rich-text sanitization and XSS prevention.
12. CSRF protections where applicable to the chosen auth architecture.
13. Rate limiting for sensitive operations, voting, search, and submissions as appropriate.
14. Duplicate-vote and abuse protection.
15. Audit logging for sensitive actions.
16. Safe generic client-facing error messages.
17. No secret exposure in client bundles, source maps, logs, or public API responses.
18. Secure redirects and production origin allowlists where applicable.
19. No hardcoded production credentials.
20. Avoid collecting unnecessary personal data.

Use server-only privileged database access. Do not expose service-role keys to browser components. Ensure users cannot modify other users' protected media or profile data without authorization. Do not log passwords, tokens, API keys, or sensitive personal information.

Document threat assumptions, permission boundaries, secret handling, deployment protections, and a production checklist in `docs/SECURITY.md`.

---

# 10. Recommended technology stack

First inspect the existing repository. Preserve a working architecture if suitable. Do not replace infrastructure merely to match this recommendation.

For a new repository, preferred defaults:

- **Frontend:** Next.js App Router, React, TypeScript.
- **Styling:** Tailwind CSS and shadcn/ui.
- **Icons:** Lucide.
- **Database:** Supabase PostgreSQL.
- **Authentication:** Supabase Auth.
- **Storage:** Supabase Storage.
- **Rich text:** TipTap or a maintained equivalent.
- **Validation:** Zod.
- **Forms:** React Hook Form where appropriate.
- **Charts:** Recharts or an appropriate maintained library.
- **Testing:** Vitest and Playwright.

Use stable, mutually compatible versions. Avoid unnecessary dependencies and unnecessary external APIs. Keep deployment cost-conscious and compatible with suitable free-tier options where possible. Never compromise security or reliability to force a free-tier deployment.

Record actual versions and architecture choices in `docs/ARCHITECTURE.md`.

---

# 11. Code quality and engineering rules

Separate concerns for:

- Public website.
- Admin application.
- CMS data access.
- Authentication.
- Authorization.
- Database operations.
- API contracts.
- Editorial workflows.
- Media operations.
- Analytics.
- Shared utilities and design-system components.

Use strict TypeScript, validated inputs, small modules, reusable components, and typed models.

Avoid:

- Excessive `any`.
- Giant monolithic components.
- Duplicate business logic.
- Hardcoded content that belongs in the CMS.
- Unnecessary client-side fetching.
- Privileged database access from browser components.
- Fake API implementations.
- Placeholder click handlers.
- Fake charts or fabricated metrics.
- Static admin forms that never persist.
- Silently swallowed errors.
- TODOs for core functionality.

Every interactive control must perform its advertised action or be clearly disabled with a truthful explanation. Implement loading, empty, error, and success states.

---

# 12. Documentation-first deliverables

Before substantial implementation, inspect the repository and create or update:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/ADMIN_RBAC.md`
- `docs/EDITORIAL_WORKFLOW.md`
- `docs/API_CONTRACTS.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/SECURITY.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/TESTING_STRATEGY.md`
- `CLAUDE.md`
- `progress.txt`
- `.env.example`

These files must describe the actual project. Do not create generic documents that contradict the code. Keep `progress.txt` current after meaningful milestones and failures.

---

# 13. Implementation phases

## Phase 0 — Repository reconnaissance

- Inspect project structure, Git status, package files, scripts, routes, components, dependencies, backend, environment configuration, and existing assets.
- Inspect the supplied visual reference.
- Identify reusable code and existing conventions.
- Do not destroy working features or overwrite uncommitted user work.
- Produce a concise assessment and note constraints.

## Phase 1 — Architecture and documentation

Create the documentation listed above. Finalize product requirements, database model, permission matrix, content model, API boundaries, UI architecture, security model, test strategy, and implementation sequence. Document important decisions and assumptions.

## Phase 2 — Design system and public frontend

Implement branding, header, navigation, hero, trending topics, story grids, categories, article page, polls, community CTA, newsletter, footer, responsive states, and all relevant public routes. Match the reference design closely.

## Phase 3 — Backend and database

Implement migrations, authentication, profiles, roles/permissions, content tables, storage, RLS, server-side data-access layer, and typed API contracts.

## Phase 4 — Admin CMS

Prioritize:

1. Login/authentication.
2. Admin dashboard.
3. Article management.
4. Article editor and revisions.
5. Media library.
6. Categories and tags.
7. Editorial workflow.
8. Homepage builder.
9. Poll management.
10. Pages.
11. Team and permissions.
12. Community moderation.
13. Newsletter management.
14. Analytics.
15. Navigation and site settings.
16. Audit logs.

## Phase 5 — Connect CMS to public website

Replace temporary data sources with actual CMS data. Verify publishing updates public content, drafts remain private, unpublishing removes content from public lists, homepage configuration changes render, featured polls update, categories/navigation update, media changes propagate, and cache invalidation works.

## Phase 6 — Testing and hardening

Test authentication, authorization, article CRUD, review, approval, publishing, scheduling, unpublishing, homepage management, poll lifecycle, vote integrity, media uploads, role restrictions, newsletter subscriptions, moderation, analytics, and responsive behavior. Fix root causes and run regression checks.

## Phase 7 — Production readiness

Prepare migrations, environment documentation, secure owner initialization, storage/auth configuration, deployment instructions, production security checklist, backup/recovery guidance, and monitoring recommendations.

---

# 14. Required self-correction protocol

This section is mandatory. Apply it whenever Claude encounters an error, failed check, regression, ambiguous behavior, or user-reported defect.

## 14.1 Error recovery loop

`Observe → Reproduce → Re-read requirements → Diagnose root cause → Fix → Verify → Regression-check → Document`

For every failure:

1. Capture the exact error, logs, command, route, and reproduction steps.
2. Identify the relevant section in this master specification.
3. Re-read related `CLAUDE.md`, architecture, database, workflow, RBAC, and security docs as needed.
4. Trace the failure across UI, API, server logic, validation, database schema, RLS, storage, authentication, authorization, environment, caching, and deployment as applicable.
5. Identify the root cause. Do not apply a symptom-only workaround.
6. Implement the smallest safe fix that satisfies the requirement.
7. Re-run the exact failing check.
8. Run adjacent regression tests and inspect affected flows.
9. Review the Git diff for unrelated changes, secret leakage, broken permissions, and accidental regressions.
10. Record the failure, root cause, fix, verification command/results, and remaining risk in `progress.txt` or the relevant issue log.

If the same error occurs twice, do not repeat the same approach without new evidence. Expand diagnosis to dependencies, contracts, migrations, policies, environment variables, logs, callers, and related workflows.

If the specification is contradictory or incomplete, choose the safest consistent interpretation, document the decision, and update the spec only when the product requirement genuinely changes. Never weaken security or acceptance criteria merely to make a test pass.

## 14.2 Phase-end self-review

At the end of every meaningful phase:

- Review applicable acceptance criteria in this document.
- Run available formatter, lint, type-check, tests, and build.
- Review the Git diff.
- Check for hardcoded CMS content, fake data, dead controls, leaked secrets, and missing server-side authorization.
- Verify the public and admin workflows affected by the change.
- Update `progress.txt` with completed work, commands run, outcomes, defects, and next steps.
- Mark a phase complete only when its relevant criteria have passed.

---

# 15. Definition of done

## Public website

- Closely matches the supplied design reference.
- Fully responsive across supported screen sizes.
- Main routes and navigation work.
- Articles and categories are database-driven.
- Homepage is CMS-controlled.
- Poll participation and results work according to configuration.
- Search works.
- Newsletter subscriptions persist.
- SEO metadata is implemented.
- No major broken links or dead controls.

## Admin CMS

- Secure login works.
- Owner and role permissions work as intended.
- Dashboard uses actual stored data/events.
- Articles can be created, edited, reviewed, approved, published, scheduled, unpublished, archived, and restored according to permissions.
- Revisions and editorial history work.
- Media upload and access controls work.
- Homepage builder persists and changes the public website.
- Categories, tags, pages, navigation, and settings persist.
- Poll creation, management, voting validation, and results work.
- Team access is managed securely.
- Community moderation works.
- Newsletter subscriptions and exports work.
- Analytics track real events and explain metric limitations.
- Audit logs capture important sensitive operations.

*(Owner decision 2026-11-07: the homepage builder, pages, navigation, poll management and the audit-log viewer were removed from Studio at the owner's request, so the items above that depend on them now hold for the stored data and the public site, not for Studio editing. Audit rows are still written. The data stays in the database and the public site still reads it. See ADR-017 in `docs/ARCHITECTURE.md`.)*

## Engineering and release

- Database migrations are version-controlled and apply cleanly.
- Authorization and RLS/storage policies are enforced and tested.
- Privileged secrets are not exposed to the browser.
- Core automated tests pass.
- TypeScript checks pass.
- Production build succeeds.
- No critical console/runtime errors remain in tested flows.
- Documentation matches the actual implementation.
- Deployment and owner-bootstrap instructions are complete.

A feature is not complete merely because the screen renders. Verify persistence, access control, state transitions, failure handling, and the user-visible workflow.

---

# 16. Execution behavior and final report

Claude Code should act autonomously and make reasonable engineering decisions without repeatedly asking for approval. Do not stop after planning. Continue through implementation, integration, testing, and hardening.

Use subagents for independent work only when available and useful. Give them clear task boundaries and file ownership. The primary agent remains responsible for integration, security review, and end-to-end verification.

When blocked by credentials, continue with independent features and document exactly what remains blocked. Never claim an integration is live without verifying it.

At completion, report:

- What was implemented.
- Actual architecture and stack.
- Database tables and migrations.
- Public website routes.
- Admin capabilities.
- Roles and security controls.
- Tests and commands run, with actual results.
- Required environment variables.
- Deployment and owner-bootstrap steps.
- Known limitations and unfinished work.

Use these status categories honestly:

- **Implemented and verified.**
- **Implemented but not fully verified.**
- **Blocked by missing credentials/services.**
- **Not implemented.**

Never invent passing tests, analytics, content, credentials, or deployment status.

---

## Final objective

Build Boses ng Bayan into a complete, production-oriented Filipino digital newsroom and community-engagement platform: a visually faithful, welcoming public website connected to a powerful private headless CMS that authorized owners and editorial staff can use for everyday publishing, homepage management, polls, moderation, analytics, and site administration without requiring a developer for routine operations.
