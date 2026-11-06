# Boses ng Bayan — Product requirements (summary)

The full, authoritative requirements are in `docs/BOSES_NG_BAYAN_MASTER_SPEC.md`. This page records the product decisions made while building, and where each requirement lives in the code. Status per feature is in `progress.txt`.

## Product

A Filipino digital newsroom and community-engagement platform.

- Tagline: "May boses ka. May saysay ang opinyon mo."
- Primary language: Filipino, with English and Taglish (`<html lang="fil">`).
- Timezone: Asia/Manila.

Two surfaces:

1. **Public website**, driven entirely by published CMS data: news, categories and topics, regions, polls, Usap Bayan community, search, newsletter, static pages, RSS and sitemap.
2. **Boses ng Bayan Studio** at `/admin`, a private newsroom console covering:
   - articles and the editorial workflow;
   - media, homepage builder and pages;
   - taxonomy, polls, moderation and newsletter;
   - analytics, team and roles, navigation, SEO and redirects, settings, and the audit log.

## Users

| User | Needs |
| --- | --- |
| Reader | Readable stories, quick topic discovery, trustworthy bylines and dates, the ability to vote and comment without an account |
| Writer | Draft with autosave, submit for review, see editor feedback |
| Editor | Review queue, publish and schedule, homepage control, polls, moderation |
| Owner / Administrator | Team, roles, settings, SEO, audit |
| Moderator | Community queues |
| Analyst | Dashboards |

## Product decisions

| # | Decision | Reason |
| --- | --- | --- |
| P1 | Readers never need an account. Voting is anonymous, with one vote per browser plus a network rate limit. | Low friction. Matches "voluntary online poll" framing; the methodology note says results are not representative. |
| P2 | Comments and submissions are moderated before they publish, by default. | Spec §3.7 requires moderation before anything public. |
| P3 | Poll options are locked once votes exist. Editors can close, archive, or create a new poll. | Spec §3.8 vote-integrity rule. Silent edits after votes would misrepresent results. |
| P4 | Results visibility is set per poll: always, after voting, after the poll closes, or never. | Spec §3.8. |
| P5 | Data-dependent blocks (Most Read, Breaking, hero ballot count) hide themselves rather than show placeholders. | Spec: no fabricated metrics. |
| P6 | Scheduled stories go live by time, not by cron. | Reliable on free hosting (ADR-008). |
| P7 | Newsletter is collection only, with no campaign sending until a provider is configured. | Spec §3.11: never claim email was sent. |
| P8 | Seed content: the base seed has structure only (categories, topics, menus, page shells, a homepage layout). Demo articles and polls come only from `pnpm seed:demo`, are labelled "[Demo]", and run locally only. | Spec §0: no invented news or statistics. |
| P9 | Staff accounts are created by invitation only, plus a one-time Owner bootstrap CLI. | Spec §4.10 and §9. |

## Out of scope for v1

These are not implemented:

- reader accounts and profiles;
- campaign email sending;
- push notifications;
- paid subscriptions or ads serving;
- multi-language content variants (UI copy is Filipino);
- real-time (WebSocket) poll results, which refresh on load or vote instead.
