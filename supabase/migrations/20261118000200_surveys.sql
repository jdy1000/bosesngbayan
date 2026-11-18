-- Boses ng Bayan — Surveys (client request 2026-11-18): a moving carousel of top-rated officials / candidates under the
-- homepage's lead story, managed in Studio -> Surveys by owners, administrators, editors and writers ("authors").
-- A survey is a titled result set (e.g. "Top-performing, most trusted vice mayors - NCR", rated on a date); its entries
-- are the people shown as cards: rank, name, place, overall / trust / performance percentages and a photo.
-- The public reads PUBLISHED surveys only (RLS); staff with surveys.manage read and write everything.
-- Rollback:
--   delete from public.homepage_sections where block_type = 'surveys';
--   alter table public.homepage_sections drop constraint homepage_sections_block_type_check;
--   alter table public.homepage_sections add constraint homepage_sections_block_type_check check (block_type in (
--     'hero', 'top_stories', 'trending_topics', 'breaking_news', 'featured_story', 'latest_articles', 'article_grid',
--     'category_showcase', 'editors_picks', 'most_read', 'poll_showcase', 'community', 'regional_news',
--     'newsletter', 'custom_cta', 'photo_of_day', 'quote_of_day', 'news_quiz'));
--   drop table public.survey_entries; drop table public.surveys;
--   delete from public.permissions where key = 'surveys.manage';  -- cascades to role_permissions
--   then re-run media_usages() from 20261107000100_ad_slots.sql.

insert into public.permissions (key, group_name, description) values
  ('surveys.manage', 'Site', 'Create, edit, publish and delete surveys and their candidates');
insert into public.role_permissions (role, permission) values
  ('owner', 'surveys.manage'), ('administrator', 'surveys.manage'), ('editor', 'surveys.manage'), ('writer', 'surveys.manage');

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  -- Short qualifier shown beside the title, e.g. "National Capital Region".
  scope text check (char_length(scope) <= 120),
  subtitle text check (char_length(subtitle) <= 240),
  -- Small print under the carousel: sponsor, method, sample. Optional; never invented.
  note text check (char_length(note) <= 500),
  survey_date date not null default ((now() at time zone 'Asia/Manila')::date),
  is_published boolean not null default false,
  show_on_homepage boolean not null default true,
  sort_order integer not null default 0 check (sort_order between -1000 and 1000),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index surveys_public_idx on public.surveys (sort_order, survey_date desc) where is_published;
create trigger surveys_touch before update on public.surveys for each row execute function public.touch_updated_at();
create trigger surveys_audit after insert or update or delete on public.surveys for each row execute function public.audit_row_change();

create table public.survey_entries (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  position integer not null default 0,
  rank_no integer check (rank_no between 1 and 999),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  area text check (char_length(area) <= 120),
  overall_pct numeric(4, 1) check (overall_pct between 0 and 100),
  trust_pct numeric(4, 1) check (trust_pct between 0 and 100),
  performance_pct numeric(4, 1) check (performance_pct between 0 and 100),
  -- restrict: a photo in use must not be deleted from under a published card (media_usages also reports it).
  photo_id uuid references public.media_assets (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index survey_entries_survey_idx on public.survey_entries (survey_id, position);
create index survey_entries_photo_idx on public.survey_entries (photo_id) where photo_id is not null;
create trigger survey_entries_touch before update on public.survey_entries for each row execute function public.touch_updated_at();
create trigger survey_entries_audit after insert or update or delete on public.survey_entries for each row execute function public.audit_row_change();

alter table public.surveys enable row level security;
alter table public.survey_entries enable row level security;
revoke insert, update, delete, truncate on public.surveys from anon;
revoke insert, update, delete, truncate on public.survey_entries from anon;
-- PostgREST never exposes these, but keep the table-level grants as small as the policies.
revoke truncate, references, trigger on public.surveys from authenticated;
revoke truncate, references, trigger on public.survey_entries from authenticated;

create policy surveys_read on public.surveys for select to anon, authenticated
  using (is_published or public.has_permission('surveys.manage'));
create policy surveys_insert on public.surveys for insert to authenticated
  with check (public.has_permission('surveys.manage'));
create policy surveys_update on public.surveys for update to authenticated
  using (public.has_permission('surveys.manage')) with check (public.has_permission('surveys.manage'));
-- Deleting a whole survey (and, by cascade, every candidate) is for its creator and for editors and above, so an author
-- can manage the section and fix any survey, but cannot wipe a colleague's.
create policy surveys_delete on public.surveys for delete to authenticated
  using (public.has_permission('surveys.manage') and (created_by = auth.uid() or public.has_permission('articles.edit_any')));

create policy survey_entries_read on public.survey_entries for select to anon, authenticated
  using (
    public.has_permission('surveys.manage')
    or exists (select 1 from public.surveys s where s.id = survey_entries.survey_id and s.is_published)
  );
create policy survey_entries_write on public.survey_entries for all to authenticated
  using (public.has_permission('surveys.manage')) with check (public.has_permission('surveys.manage'));

-- Homepage block: the new `surveys` type (no settings; what shows is decided by each survey's own switches).
alter table public.homepage_sections drop constraint homepage_sections_block_type_check;
alter table public.homepage_sections add constraint homepage_sections_block_type_check check (block_type in (
  'hero', 'top_stories', 'surveys', 'trending_topics', 'breaking_news', 'featured_story', 'latest_articles', 'article_grid',
  'category_showcase', 'editors_picks', 'most_read', 'poll_showcase', 'community', 'regional_news',
  'newsletter', 'custom_cta', 'photo_of_day', 'quote_of_day', 'news_quiz'));

-- Media usage: as in 20261107000100 plus survey photos, so a photo used by a survey is listed and cannot be deleted.
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
    union all
    select 'survey_entry', e.id,
           case when public.has_permission('surveys.manage') then concat_ws(' - ', e.name, sv.title) end,
           case when sv.is_published then 'published survey' else 'draft survey' end
    from public.survey_entries e
    join public.surveys sv on sv.id = e.survey_id, m
    where e.photo_id = m.id
  )
  select usage_kind, ref_id, label, detail from hits
  where public.is_staff() or public.is_service_context();
$$;
revoke all on function public.media_usages(uuid) from public, anon;
grant execute on function public.media_usages(uuid) to authenticated, service_role;

-- Put the block right after top_stories in the draft and the published configuration (idempotent: skips a configuration
-- that already has one). The renderer shows it between the lead story and the story grid; with no published survey it
-- renders nothing.
do $$
declare
  v_cfg uuid;
  v_pos integer;
begin
  for v_cfg in
    select c.id from public.homepage_configurations c
    where c.status in ('draft', 'published')
      and not exists (select 1 from public.homepage_sections s where s.configuration_id = c.id and s.block_type = 'surveys')
  loop
    select coalesce(max(position) filter (where block_type = 'top_stories'), 0) + 1 into v_pos
    from public.homepage_sections where configuration_id = v_cfg;
    update public.homepage_sections set position = position + 1 where configuration_id = v_cfg and position >= v_pos;
    insert into public.homepage_sections (configuration_id, block_type, position, title, title_en, settings)
    values (v_cfg, 'surveys', v_pos, 'Mga Survey', 'Surveys', '{}'::jsonb);
  end loop;
end;
$$;
