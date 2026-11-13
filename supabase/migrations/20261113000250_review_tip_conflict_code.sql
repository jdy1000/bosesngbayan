-- review_tip(): raise tip_changed with SQLSTATE 22023 instead of 40001 (ADR-024).
-- 40001 is serialization_failure, which PostgREST retries as a transient error. Because a stale form fails
-- the same way every time, the request never returned and Studio stayed on "Saving…" (found by the
-- end-to-end check of 2026-11-13; nothing was written). 22023 is what the other "already changed"
-- refusals use (application_already_reviewed). Same signature, so the existing grants stay.
-- Rollback: re-run the review_tip definition from 20261113000200_tips.sql.

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
    raise exception 'tip_changed' using errcode = '22023';
  end if;
  update public.tips
     set status = p_status, staff_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'review_tip', 'tips', p_id::text, jsonb_build_object('from', v_status, 'to', p_status));
end;
$$;
