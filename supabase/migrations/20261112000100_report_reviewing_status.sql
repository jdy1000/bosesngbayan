-- Boses ng Bayan — reader reports get a fourth status, 'reviewing' (open → reviewing → resolved | dismissed),
-- so a moderator can mark a report as being looked at without closing it.
-- This statement is alone in its file on purpose: Postgres refuses to USE a new enum value in the
-- transaction that added it, and each migration file runs as one transaction. resolve_report() is
-- updated in the next file (20261112000200).
-- Rollback: Postgres cannot drop an enum value. Restore resolve_report() from 20261106000300 and move any
--   'reviewing' rows back with: update public.moderation_reports set status = 'open' where status = 'reviewing';

alter type public.report_status add value if not exists 'reviewing' after 'open';
