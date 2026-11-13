-- Boses ng Bayan — tip line ("Mag-ulat ng katiwalian", ADR-024).
-- The client's mission statement (ADR-023) asks every Filipino to report suspected corruption. A tip is
-- private: it is never published, and only tips.manage holders (owner, administrator, editor) can read it.
-- Privacy: the row keeps no IP address and no network hash (rate limiting uses the short-lived
-- rate_limits table only); the submitter's name and contact are optional.
-- Writes: submit_tip() (service_role only, called by POST /api/public/v1/tips after Zod validation,
--   honeypot and rate limit) and review_tip() (tips.manage, audited without the tip's content).
-- Retention: dismissed tips are deleted 180 days after dismissal by the daily retention job.
-- Rollback: drop function public.purge_old_tips(); drop function public.review_tip(uuid, text, text, timestamptz);
--   drop function public.submit_tip(text, text, text, text, text[], text, text); drop table public.tips;
--   delete from public.permissions where key = 'tips.manage' (cascades to role_permissions).
-- The header and footer links are in 20261113000300_tip_line_nav.sql, applied after the code is deployed.

insert into public.permissions (key, group_name, description) values
  ('tips.manage', 'Investigations', 'Read and handle tips sent through the public tip line');
-- Owner gets every permission; administrator everything except roles.manage (see core_rbac). Editors run the desk.
insert into public.role_permissions (role, permission) values
  ('owner', 'tips.manage'), ('administrator', 'tips.manage'), ('editor', 'tips.manage');

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 5 and 200),
  details text not null check (char_length(details) between 30 and 8000),
  agency text check (char_length(agency) <= 200),
  location text check (char_length(location) <= 120),
  -- Each element is checked in submit_tip(), the only way rows are written.
  evidence_urls text[] not null default '{}' check (cardinality(evidence_urls) <= 5),
  contact_name text check (char_length(contact_name) <= 120),
  contact text check (char_length(contact) <= 200),
  status text not null default 'new' check (status in ('new', 'reviewing', 'verified', 'dismissed')),
  staff_note text check (char_length(staff_note) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'new') = (reviewed_at is null)),
  check (status <> 'dismissed' or staff_note is not null)
);
create index tips_status_idx on public.tips (status, created_at desc);
create trigger tips_touch before update on public.tips for each row execute function public.touch_updated_at();

alter table public.tips enable row level security;
-- Read-only for tips.manage holders. No insert/update/delete policy: submissions go through the
-- service-role RPC and every status change through review_tip(), which audits it.
create policy tips_read on public.tips for select to authenticated using (public.has_permission('tips.manage'));
revoke all on public.tips from anon;
revoke insert, update, delete, truncate, references, trigger on public.tips from authenticated;

create or replace function public.submit_tip(
  p_subject text, p_details text, p_agency text, p_location text, p_evidence_urls text[],
  p_contact_name text, p_contact text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
begin
  foreach v_url in array coalesce(p_evidence_urls, '{}') loop
    if v_url is null or v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 500 then
      raise exception 'invalid_evidence_url' using errcode = '22023';
    end if;
  end loop;
  insert into public.tips (subject, details, agency, location, evidence_urls, contact_name, contact)
  values (btrim(p_subject), btrim(p_details), nullif(btrim(p_agency), ''), nullif(btrim(p_location), ''),
          coalesce(p_evidence_urls, '{}'), nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact), ''));
end;
$$;
revoke all on function public.submit_tip(text, text, text, text, text[], text, text) from public, anon, authenticated;
grant execute on function public.submit_tip(text, text, text, text, text[], text, text) to service_role;

-- Status change (new → reviewing | verified | dismissed, and between those three), audited.
-- The note replaces the previous one; Studio pre-fills it. The audit row carries only the two statuses.
-- p_expected_updated_at is the updated_at the editor's form was built from: if someone saved the tip since,
-- the change is refused (tip_changed) instead of silently overwriting their status and note.
create or replace function public.review_tip(p_id uuid, p_status text, p_note text, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_updated timestamptz;
begin
  if not public.has_permission('tips.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('reviewing', 'verified', 'dismissed') then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if p_status = 'dismissed' and nullif(btrim(p_note), '') is null then
    raise exception 'dismissal_reason_required' using errcode = '22023';
  end if;
  select status, updated_at into v_status, v_updated from public.tips where id = p_id for update;
  if not found then
    raise exception 'tip_not_found' using errcode = 'P0002';
  end if;
  if v_updated is distinct from p_expected_updated_at then
    raise exception 'tip_changed' using errcode = '40001';
  end if;
  update public.tips
     set status = p_status, staff_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'review_tip', 'tips', p_id::text, jsonb_build_object('from', v_status, 'to', p_status));
end;
$$;
revoke all on function public.review_tip(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_tip(uuid, text, text, timestamptz) to authenticated, service_role;

create or replace function public.purge_old_tips()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not public.is_service_context() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.tips where status = 'dismissed' and reviewed_at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_tips() from public, anon, authenticated;
grant execute on function public.purge_old_tips() to service_role;
