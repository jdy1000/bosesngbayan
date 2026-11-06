-- English mode for the public site (ADR-015): optional English labels the newsroom can fill in Studio.
-- Empty means "show the Filipino label". Articles and pages are not translated.
-- Rollback: recreate publish_homepage/restore_homepage_to_draft from 20261106000200_content.sql, then drop the columns.
alter table public.navigation_items add column label_en text check (char_length(label_en) between 1 and 60);
alter table public.homepage_sections
  add column title_en text check (char_length(title_en) <= 200),
  add column description_en text check (char_length(description_en) <= 600);

-- Publishing and restoring copy sections row by row, so they must carry the new columns.
create or replace function public.publish_homepage(p_label text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_draft uuid;
  v_new uuid;
begin
  if not public.is_service_context() and not public.has_permission('homepage.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select id into v_draft from public.homepage_configurations where status = 'draft' for update;
  if v_draft is null then
    raise exception 'no_draft' using errcode = 'P0002';
  end if;
  update public.homepage_configurations set status = 'archived' where status = 'published';
  insert into public.homepage_configurations (status, label, published_at, published_by, updated_by)
  values ('published', left(p_label, 200), now(), auth.uid(), auth.uid())
  returning id into v_new;
  insert into public.homepage_sections (configuration_id, block_type, position, is_enabled, title, description, title_en, description_en, settings)
  select v_new, block_type, position, is_enabled, title, description, title_en, description_en, settings
  from public.homepage_sections where configuration_id = v_draft;
  perform public.write_audit('publish', 'homepage_configurations', v_new::text, jsonb_build_object('label', p_label));
  return v_new;
end;
$$;
revoke all on function public.publish_homepage(text) from public, anon;
grant execute on function public.publish_homepage(text) to authenticated, service_role;

-- Restore an archived/published configuration into the working draft.
create or replace function public.restore_homepage_to_draft(p_configuration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_draft uuid;
begin
  if not public.is_service_context() and not public.has_permission('homepage.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.homepage_configurations where id = p_configuration_id and status <> 'draft') then
    raise exception 'configuration_not_found' using errcode = 'P0002';
  end if;
  select id into v_draft from public.homepage_configurations where status = 'draft' for update;
  if v_draft is null then
    insert into public.homepage_configurations (status, updated_by) values ('draft', auth.uid()) returning id into v_draft;
  end if;
  delete from public.homepage_sections where configuration_id = v_draft;
  insert into public.homepage_sections (configuration_id, block_type, position, is_enabled, title, description, title_en, description_en, settings)
  select v_draft, block_type, position, is_enabled, title, description, title_en, description_en, settings
  from public.homepage_sections where configuration_id = p_configuration_id;
  update public.homepage_configurations set updated_by = auth.uid() where id = v_draft;
end;
$$;
