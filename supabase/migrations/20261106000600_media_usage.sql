-- Boses ng Bayan — media usage references and in-use delete protection.
--
-- Why: the Media Library must show every place an asset is used and refuse to delete assets
-- still in use. A session-client query cannot do that reliably because RLS hides drafts the
-- caller may not read (other writers' articles, draft pages, the draft homepage), and the
-- foreign keys are ON DELETE SET NULL, which would silently strip images from live content.

create or replace function public.media_usages(p_media_id uuid)
returns table (usage_kind text, ref_id uuid, label text, detail text)
language sql stable security definer set search_path = public as $$
  with m as (select id, storage_path from public.media_assets where id = p_media_id),
  hits as (
    select 'article'::text as usage_kind, a.id as ref_id,
           case when public.can_view_article(a.id) then a.title end as label,
           concat_ws(', ',
             case when a.featured_image_id = m.id then 'featured image' end,
             case when a.og_image_id = m.id then 'OG image' end,
             case when m.storage_path is not null and position(m.storage_path in a.body_html) > 0 then 'nasa body' end) as detail
    from public.articles a, m
    where a.featured_image_id = m.id or a.og_image_id = m.id
       or (m.storage_path is not null and position(m.storage_path in a.body_html) > 0)
    union all
    select 'category', c.id, c.name, 'larawan ng kategorya'
    from public.categories c, m where c.image_id = m.id
    union all
    select 'page', p.id,
           case when p.status = 'published' or public.has_permission('pages.manage') then p.title end,
           concat_ws(', ',
             case when p.og_image_id = m.id then 'OG image' end,
             case when m.storage_path is not null and position(m.storage_path in p.body_html) > 0 then 'nasa body' end)
    from public.pages p, m
    where p.og_image_id = m.id or (m.storage_path is not null and position(m.storage_path in p.body_html) > 0)
    union all
    select 'site_setting', null::uuid, s.key, 'site settings'
    from public.site_settings s, m
    where jsonb_path_exists(s.value, '$.** ? (@ == $id)', jsonb_build_object('id', m.id::text))
    union all
    select 'homepage_section', hs.id,
           case when public.has_permission('homepage.manage') then coalesce(nullif(hs.title, ''), hs.block_type) end,
           hc.status::text
    from public.homepage_sections hs
    join public.homepage_configurations hc on hc.id = hs.configuration_id, m
    where hc.status in ('draft', 'published')
      and jsonb_path_exists(hs.settings, '$.** ? (@ == $id)', jsonb_build_object('id', m.id::text))
  )
  select usage_kind, ref_id, label, detail from hits
  where public.is_staff() or public.is_service_context();
$$;
revoke all on function public.media_usages(uuid) from public, anon;
grant execute on function public.media_usages(uuid) to authenticated, service_role;

create or replace function public.media_assets_block_in_use()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.media_usages(old.id)) then
    raise exception 'media_in_use' using errcode = '23503';
  end if;
  return old;
end;
$$;
create trigger media_assets_block_in_use before delete on public.media_assets
  for each row execute function public.media_assets_block_in_use();
