-- Boses ng Bayan — resolve_report() with the 'reviewing' status (enum value added in 20261112000100).
-- Before: every status except 'open' stamped resolved_by / resolved_at, so 'reviewing' would have looked closed.
-- Now: only a closing decision ('resolved' or 'dismissed') records who decided and when; moving a report back
-- to 'open' or 'reviewing' clears both. Signature, permission check, activity log and grants are unchanged.
-- Rollback: re-run the resolve_report() definition from 20261106000300_engagement.sql.

create or replace function public.resolve_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_from text;
begin
  if not public.has_permission('moderation.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select status::text into v_from from public.moderation_reports where id = p_report_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.moderation_reports
     set status = p_status,
         resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() end,
         resolved_at = case when p_status in ('resolved', 'dismissed') then now() end,
         resolution_note = nullif(btrim(p_note), '')
   where id = p_report_id;
  insert into public.content_activity_logs (actor_id, entity_type, entity_id, action, from_status, to_status, note)
  values (auth.uid(), 'report', p_report_id, 'report:' || p_status::text, v_from, p_status::text, left(nullif(btrim(p_note), ''), 2000));
end;
$$;
revoke all on function public.resolve_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.resolve_report(uuid, public.report_status, text) to authenticated;
