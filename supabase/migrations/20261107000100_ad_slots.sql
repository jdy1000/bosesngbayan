-- Boses ng Bayan — ad inventory (direct-sold image ads managed in Studio → Ad inventory).
-- An ad is publicly readable only while it is live: active and inside its optional start/end window.
-- Rollback: drop table public.ad_slots; re-run 20261106000600_media_usage.sql's media_usages();
--           delete from public.permissions where key = 'ads.manage' (cascades to role_permissions).

insert into public.permissions (key, group_name, description) values
  ('ads.manage', 'Site', 'Create, edit, activate and delete ad slots');
-- Owner gets every permission; administrator gets everything except roles.manage (see core_rbac).
insert into public.role_permissions (role, permission) values
  ('owner', 'ads.manage'), ('administrator', 'ads.manage');

create table public.ad_slots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  placement text not null check (placement in ('home', 'article')),
  -- restrict: an ad must never silently lose its creative (media_usages also blocks the delete).
  image_id uuid not null references public.media_assets (id) on delete restrict,
  alt_text text check (char_length(alt_text) <= 300),
  destination_url text not null check (destination_url ~ '^https://[^[:space:]]+$' and char_length(destination_url) <= 2048),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index ad_slots_live_idx on public.ad_slots (placement, sort_order, created_at) where is_active;
create index ad_slots_image_idx on public.ad_slots (image_id);
create trigger ad_slots_touch before update on public.ad_slots for each row execute function public.touch_updated_at();
create trigger ad_slots_audit after insert or update or delete on public.ad_slots for each row execute function public.audit_row_change();

alter table public.ad_slots enable row level security;
revoke insert, update, delete, truncate on public.ad_slots from anon;

create policy ad_slots_read on public.ad_slots for select to anon, authenticated
  using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or public.has_permission('ads.manage')
  );
create policy ad_slots_write on public.ad_slots for all to authenticated
  using (public.has_permission('ads.manage')) with check (public.has_permission('ads.manage'));

-- Media usage: same as 20261106000600 plus ad creatives, so an image used by an ad cannot be deleted.
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
    union all
    select 'ad_slot', ad.id,
           case when public.has_permission('ads.manage') then ad.name end,
           case when ad.is_active then 'active ad' else 'inactive ad' end
    from public.ad_slots ad, m where ad.image_id = m.id
  )
  select usage_kind, ref_id, label, detail from hits
  where public.is_staff() or public.is_service_context();
$$;
revoke all on function public.media_usages(uuid) from public, anon;
grant execute on function public.media_usages(uuid) to authenticated, service_role;
