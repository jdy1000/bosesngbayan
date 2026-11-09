-- Boses ng Bayan — publisher applications ("Apply for newsroom access").
-- A public request to join the newsroom. Submitting creates NO auth account and grants NO access
-- (spec §4.10: no public admin registration). A users.manage holder reviews it in Studio; approval
-- reuses the normal team invitation (Supabase Auth invite + set_user_role), rejection records a reason.
-- Writes: submit_publisher_application() (service_role only, called by the server action after Zod
-- validation, honeypot and rate limit) and review_publisher_application() (users.manage, audited).
-- Rollback: drop function public.purge_old_publisher_applications(); drop function
--   public.review_publisher_application(uuid, text, text, public.app_role, uuid); drop function
--   public.submit_publisher_application(text, text, public.app_role, text, text, text, text);
--   drop table public.publisher_applications;

create table public.publisher_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  requested_role public.app_role not null default 'writer' check (requested_role in ('writer', 'moderator')),
  organization text check (char_length(organization) <= 160),
  portfolio_url text check (portfolio_url ~ '^https://[^\s]+$' and char_length(portfolio_url) <= 500),
  message text not null check (char_length(message) between 1 and 2000),
  consent_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  invited_user_id uuid references public.profiles (id) on delete set null,
  network_hash text check (char_length(network_hash) <= 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending') = (reviewed_at is null)),
  check (status <> 'rejected' or review_note is not null)
);
-- At most one open application per email; reviewed ones may repeat (e.g. re-apply after rejection).
create unique index publisher_applications_one_pending_idx on public.publisher_applications (email) where status = 'pending';
create index publisher_applications_status_idx on public.publisher_applications (status, created_at desc);
create trigger publisher_applications_touch before update on public.publisher_applications
  for each row execute function public.touch_updated_at();

alter table public.publisher_applications enable row level security;
-- Read-only for users.manage holders. No insert/update/delete policy: submissions go through the
-- service-role RPC and every decision through review_publisher_application(), which audits it.
create policy publisher_applications_read on public.publisher_applications
  for select to authenticated using (public.has_permission('users.manage'));
revoke all on public.publisher_applications from anon;
revoke insert, update, delete, truncate, references, trigger on public.publisher_applications from authenticated;

-- Public submission. Silently ignores a second pending application for the same email so the
-- response never reveals whether an address already applied (or is already staff).
create or replace function public.submit_publisher_application(
  p_full_name text, p_email text, p_requested_role public.app_role, p_organization text,
  p_portfolio_url text, p_message text, p_network_hash text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.publisher_applications (full_name, email, requested_role, organization, portfolio_url, message, network_hash)
  values (btrim(p_full_name), lower(btrim(p_email)), p_requested_role, nullif(btrim(p_organization), ''),
          nullif(btrim(p_portfolio_url), ''), btrim(p_message), p_network_hash)
  on conflict (email) where status = 'pending' do nothing;
end;
$$;
revoke all on function public.submit_publisher_application(text, text, public.app_role, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_publisher_application(text, text, public.app_role, text, text, text, text) to service_role;

-- Review decision (pending → approved | rejected), audited. The invitation itself happens in the
-- server action (Supabase Auth admin API); p_invited_user_id records the resulting account.
-- The audit row deliberately omits the applicant's name, email and message (personal data stays
-- in this table, which the retention job purges).
create or replace function public.review_publisher_application(
  p_id uuid, p_decision text, p_note text default null, p_role public.app_role default null, p_invited_user_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.has_permission('users.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(btrim(p_note), '') is null then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;
  -- p_role is the role this approval granted; null when the applicant was already staff (no invitation).
  if p_decision = 'approved' and p_role is not null and p_role not in ('writer', 'moderator') then
    raise exception 'invalid_application_role' using errcode = '22023';
  end if;
  select status into v_status from public.publisher_applications where id = p_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'application_already_reviewed' using errcode = '22023';
  end if;
  update public.publisher_applications
     set status = p_decision, review_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now(),
         invited_user_id = case when p_decision = 'approved' then p_invited_user_id end
   where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_decision = 'approved' then 'approve_application' else 'reject_application' end,
          'publisher_applications', p_id::text,
          jsonb_strip_nulls(jsonb_build_object('role', case when p_decision = 'approved' then p_role end,
                                               'invited_user_id', p_invited_user_id)));
end;
$$;
revoke all on function public.review_publisher_application(uuid, text, text, public.app_role, uuid) from public, anon;
grant execute on function public.review_publisher_application(uuid, text, text, public.app_role, uuid) to authenticated, service_role;

-- Retention (called by the daily /api/cron/retention job): reviewed applications are deleted
-- 180 days after the decision. Pending ones stay until an administrator decides.
create or replace function public.purge_old_publisher_applications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not public.is_service_context() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.publisher_applications where status <> 'pending' and reviewed_at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_publisher_applications() from public, anon, authenticated;
grant execute on function public.purge_old_publisher_applications() to service_role;
