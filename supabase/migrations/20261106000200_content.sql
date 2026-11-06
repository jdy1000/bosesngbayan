-- Boses ng Bayan — editorial content: media, taxonomy, articles, workflow, pages,
-- homepage builder, navigation, trending topics, redirects.

-- ---------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------
create type public.media_kind as enum ('image', 'video', 'file');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null default 'image',
  storage_path text unique check (storage_path is null or storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  external_url text check (external_url is null or external_url ~ '^https://'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text check (char_length(mime_type) <= 100),
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  title text check (char_length(title) <= 200),
  alt_text text check (char_length(alt_text) <= 300),
  caption text check (char_length(caption) <= 600),
  credit text check (char_length(credit) <= 200),
  folder text not null default 'pangkalahatan' check (char_length(folder) between 1 and 60),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index media_assets_created_idx on public.media_assets (created_at desc);
create index media_assets_folder_idx on public.media_assets (folder);
create index media_assets_search_idx on public.media_assets using gin ((coalesce(title, '') || ' ' || file_name || ' ' || coalesce(alt_text, '')) extensions.gin_trgm_ops);
create trigger media_assets_touch before update on public.media_assets for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Taxonomy
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  image_id uuid references public.media_assets (id) on delete set null,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_sort_idx on public.categories (sort_order, name);
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tags_touch before update on public.tags for each row execute function public.touch_updated_at();

create type public.location_kind as enum ('island_group', 'region', 'province', 'city');

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  kind public.location_kind not null,
  parent_id uuid references public.locations (id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is distinct from id),
  check ((kind = 'island_group') = (parent_id is null))
);
create index locations_parent_idx on public.locations (parent_id);

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
create type public.article_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'scheduled', 'published', 'archived');

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  title text not null check (char_length(title) between 1 and 300),
  subtitle text check (char_length(subtitle) <= 400),
  excerpt text check (char_length(excerpt) <= 600),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_html text not null default '',
  body_text text not null default '',
  status public.article_status not null default 'draft',
  category_id uuid references public.categories (id) on delete restrict,
  location_id uuid references public.locations (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete restrict,
  featured_image_id uuid references public.media_assets (id) on delete set null,
  og_image_id uuid references public.media_assets (id) on delete set null,
  is_featured boolean not null default false,
  is_breaking boolean not null default false,
  is_editors_pick boolean not null default false,
  allow_comments boolean not null default true,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  canonical_url text check (canonical_url is null or canonical_url ~ '^https://'),
  source_attribution text check (char_length(source_attribution) <= 1000),
  correction_note text check (char_length(correction_note) <= 1000),
  reading_minutes integer not null default 1 check (reading_minutes between 1 and 240),
  published_at timestamptz,
  first_published_at timestamptz,
  content_updated_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  review_note text check (char_length(review_note) <= 2000),
  rejection_reason text check (char_length(rejection_reason) <= 2000),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '') || ' ' || coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(body_text, '')), 'C')
  ) stored
);
create index articles_public_idx on public.articles (status, published_at desc);
create index articles_category_idx on public.articles (category_id, published_at desc);
create index articles_location_idx on public.articles (location_id);
create index articles_author_idx on public.articles (author_id);
create index articles_updated_idx on public.articles (updated_at desc);
create index articles_search_idx on public.articles using gin (search_vector);
create index articles_title_trgm_idx on public.articles using gin (title extensions.gin_trgm_ops);

-- The single definition of "publicly visible". Scheduled articles go live at published_at even if
-- the scheduler has not yet flipped their status.
create or replace function public.article_is_public(p_status public.article_status, p_published_at timestamptz)
returns boolean language sql stable as $$
  select p_status in ('published', 'scheduled') and p_published_at is not null and p_published_at <= now();
$$;

create or replace function public.can_edit_article(p_article_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.articles a
    where a.id = p_article_id
      and (public.has_permission('articles.edit_any')
           or (public.has_permission('articles.edit_own') and a.author_id = auth.uid() and a.status in ('draft', 'rejected')))
  );
$$;



create table public.article_contributors (
  article_id uuid not null references public.articles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_label text not null default 'Kontribyutor' check (char_length(role_label) between 1 and 60),
  position integer not null default 0,
  primary key (article_id, profile_id)
);
create index article_contributors_profile_idx on public.article_contributors (profile_id);

create or replace function public.can_view_article(p_article_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.articles a
    where a.id = p_article_id
      and (public.article_is_public(a.status, a.published_at)
           or public.has_permission('articles.view_all')
           or (public.is_staff() and a.author_id = auth.uid())
           or (public.is_staff() and exists (select 1 from public.article_contributors c where c.article_id = a.id and c.profile_id = auth.uid())))
  );
$$;

create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);
create index article_tags_tag_idx on public.article_tags (tag_id);

create table public.related_articles (
  article_id uuid not null references public.articles (id) on delete cascade,
  related_article_id uuid not null references public.articles (id) on delete cascade,
  position integer not null default 0,
  primary key (article_id, related_article_id),
  check (article_id <> related_article_id)
);

create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  revision_number integer not null,
  title text not null,
  snapshot jsonb not null,
  note text check (char_length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

-- Guard: workflow columns can only change through transition_article() / scheduler.
create or replace function public.articles_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.status := 'draft';
      new.published_at := null; new.first_published_at := null; new.content_updated_at := null;
      new.submitted_at := null; new.reviewed_at := null; new.reviewed_by := null;
      new.approved_at := null; new.approved_by := null; new.published_by := null;
      new.rejection_reason := null; new.review_note := null; new.archived_at := null;
      new.created_by := auth.uid();
      if not public.has_permission('articles.publish') then
        new.is_featured := false; new.is_breaking := false; new.is_editors_pick := false;
      end if;
    end if;
    return new;
  end if;

  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       or new.published_at is distinct from old.published_at
       or new.first_published_at is distinct from old.first_published_at
       or new.submitted_at is distinct from old.submitted_at
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.published_by is distinct from old.published_by
       or new.rejection_reason is distinct from old.rejection_reason
       or new.review_note is distinct from old.review_note
       or new.archived_at is distinct from old.archived_at
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'workflow_fields_protected' using errcode = '42501';
    end if;
    if (new.is_featured is distinct from old.is_featured
        or new.is_breaking is distinct from old.is_breaking
        or new.is_editors_pick is distinct from old.is_editors_pick)
       and not public.has_permission('articles.publish') then
      raise exception 'placement_requires_publish_permission' using errcode = '42501';
    end if;
    if new.author_id is distinct from old.author_id and not public.has_permission('articles.edit_any') then
      raise exception 'author_change_not_allowed' using errcode = '42501';
    end if;
    -- Substantive edits to live content are surfaced publicly as "Na-update".
    if public.article_is_public(old.status, old.published_at)
       and (new.title is distinct from old.title or new.body is distinct from old.body
            or new.subtitle is distinct from old.subtitle or new.correction_note is distinct from old.correction_note) then
      new.content_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger articles_guard before insert or update on public.articles
  for each row execute function public.articles_guard();

create trigger articles_delete_audit after delete on public.articles
  for each row execute function public.audit_row_change();

-- Snapshot current article state as a revision.
create or replace function public.snapshot_article(p_article_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_article public.articles;
  v_next integer;
  v_id uuid;
begin
  if not public.is_service_context() and not public.can_view_article(p_article_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not public.is_service_context() and not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_article from public.articles where id = p_article_id;
  if not found then
    raise exception 'article_not_found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('article_revision:' || p_article_id::text));
  select coalesce(max(revision_number), 0) + 1 into v_next from public.article_revisions where article_id = p_article_id;
  insert into public.article_revisions (article_id, revision_number, title, snapshot, note, created_by)
  values (
    p_article_id, v_next, v_article.title,
    jsonb_build_object(
      'title', v_article.title, 'subtitle', v_article.subtitle, 'slug', v_article.slug,
      'excerpt', v_article.excerpt, 'body', v_article.body, 'category_id', v_article.category_id,
      'location_id', v_article.location_id, 'featured_image_id', v_article.featured_image_id,
      'seo_title', v_article.seo_title, 'seo_description', v_article.seo_description,
      'canonical_url', v_article.canonical_url, 'source_attribution', v_article.source_attribution,
      'correction_note', v_article.correction_note, 'status', v_article.status,
      'tag_ids', coalesce((select jsonb_agg(tag_id) from public.article_tags where article_id = p_article_id), '[]'::jsonb)
    ),
    left(p_note, 500), auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.snapshot_article(uuid, text) from public, anon;
grant execute on function public.snapshot_article(uuid, text) to authenticated, service_role;

-- The editorial state machine. All status changes go through here (see docs/EDITORIAL_WORKFLOW.md).
create or replace function public.transition_article(
  p_article_id uuid,
  p_to public.article_status,
  p_note text default null,
  p_publish_at timestamptz default null
) returns public.articles language plpgsql security definer set search_path = public as $$
declare
  a public.articles;
  v_from public.article_status;
  v_uid uuid := auth.uid();
  v_is_author boolean;
  v_ok boolean := false;
  v_service boolean := public.is_service_context();
begin
  if not v_service and not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into a from public.articles where id = p_article_id for update;
  if not found then
    raise exception 'article_not_found' using errcode = 'P0002';
  end if;
  v_from := a.status;
  v_is_author := a.author_id = v_uid;

  if v_from = p_to then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  v_ok := case
    when v_from in ('draft', 'rejected') and p_to = 'pending_review'
      then public.has_permission('articles.submit') and (v_is_author or public.has_permission('articles.edit_any'))
    when v_from = 'pending_review' and p_to = 'draft'
      then (v_is_author and public.has_permission('articles.submit')) or public.has_permission('articles.review')
    when v_from = 'rejected' and p_to = 'draft'
      then v_is_author or public.has_permission('articles.edit_any')
    when v_from = 'pending_review' and p_to in ('approved', 'rejected')
      then public.has_permission('articles.review')
    when v_from in ('approved', 'draft') and p_to in ('published', 'scheduled')
      then public.has_permission('articles.publish')
    when v_from = 'approved' and p_to = 'draft'
      then public.has_permission('articles.review') or public.has_permission('articles.publish')
    when v_from = 'scheduled' and p_to in ('published', 'draft')
      then v_service or public.has_permission('articles.publish')
    when v_from = 'published' and p_to = 'draft'
      then public.has_permission('articles.publish')
    when v_from <> 'archived' and p_to = 'archived'
      then public.has_permission('articles.archive')
    when v_from = 'archived' and p_to = 'draft'
      then public.has_permission('articles.archive')
    else false
  end;

  if not v_ok then
    raise exception 'transition_not_allowed' using errcode = '42501';
  end if;

  if p_to = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;
  if p_to in ('published', 'scheduled', 'pending_review') then
    if a.category_id is null then
      raise exception 'category_required' using errcode = '22023';
    end if;
    if coalesce(btrim(a.body_text), '') = '' then
      raise exception 'body_required' using errcode = '22023';
    end if;
  end if;
  if p_to = 'scheduled' and (p_publish_at is null or p_publish_at <= now()) then
    raise exception 'schedule_must_be_future' using errcode = '22023';
  end if;

  update public.articles set
    status = p_to,
    submitted_at = case when p_to = 'pending_review' then now() else submitted_at end,
    rejection_reason = case when p_to = 'rejected' then left(btrim(p_note), 2000)
                            when p_to = 'pending_review' then null else rejection_reason end,
    review_note = case when p_to = 'approved' then left(nullif(btrim(p_note), ''), 2000) else review_note end,
    reviewed_at = case when p_to in ('approved', 'rejected') then now() else reviewed_at end,
    reviewed_by = case when p_to in ('approved', 'rejected') then v_uid else reviewed_by end,
    approved_at = case when p_to = 'approved' then now()
                       when p_to in ('published', 'scheduled') and v_from = 'draft' then now() else approved_at end,
    approved_by = case when p_to = 'approved' then v_uid
                       when p_to in ('published', 'scheduled') and v_from = 'draft' then v_uid else approved_by end,
    published_at = case
      when p_to = 'scheduled' then p_publish_at
      when p_to = 'published' and v_from = 'scheduled' and a.published_at <= now() then a.published_at
      when p_to = 'published' then coalesce(a.first_published_at, now())
      when p_to = 'draft' and v_from = 'scheduled' then a.first_published_at
      else published_at end,
    first_published_at = case
      when p_to = 'published' and v_from = 'scheduled' and a.published_at <= now() then coalesce(a.first_published_at, a.published_at)
      when p_to = 'published' then coalesce(a.first_published_at, now())
      else first_published_at end,
    published_by = case when p_to in ('published', 'scheduled') then coalesce(v_uid, published_by) else published_by end,
    archived_at = case when p_to = 'archived' then now() when v_from = 'archived' then null else archived_at end
  where id = p_article_id
  returning * into a;

  insert into public.content_activity_logs (actor_id, entity_type, entity_id, action, from_status, to_status, note)
  values (v_uid, 'article', p_article_id,
          case when v_uid is null then 'scheduler' else 'transition' end,
          v_from::text, p_to::text, left(nullif(btrim(p_note), ''), 2000));

  if p_to in ('published', 'scheduled', 'pending_review') then
    perform public.snapshot_article(p_article_id, 'Status: ' || p_to::text);
  end if;
  return a;
end;
$$;
revoke all on function public.transition_article(uuid, public.article_status, text, timestamptz) from public, anon;
grant execute on function public.transition_article(uuid, public.article_status, text, timestamptz) to authenticated, service_role;

-- Scheduler: flip due scheduled articles to published (called by the cron route with the service key).
create or replace function public.publish_due_articles()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  if not public.is_service_context() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  for r in select id from public.articles where status = 'scheduled' and published_at <= now() order by published_at loop
    perform public.transition_article(r.id, 'published', 'Awtomatikong nailathala ayon sa iskedyul', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.publish_due_articles() from public, anon, authenticated;
grant execute on function public.publish_due_articles() to service_role;

-- ---------------------------------------------------------------------------
-- Static pages
-- ---------------------------------------------------------------------------
create type public.page_status as enum ('draft', 'published', 'archived');

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 1 and 200),
  summary text check (char_length(summary) <= 600),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_html text not null default '',
  body_text text not null default '',
  status public.page_status not null default 'draft',
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  canonical_url text check (canonical_url is null or canonical_url ~ '^https://'),
  og_image_id uuid references public.media_assets (id) on delete set null,
  robots_noindex boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();
create trigger pages_audit after delete on public.pages for each row execute function public.audit_row_change();

create table public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  revision_number integer not null,
  title text not null,
  snapshot jsonb not null,
  note text check (char_length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, revision_number)
);

create or replace function public.snapshot_page(p_page_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_page public.pages;
  v_next integer;
  v_id uuid;
begin
  if not public.is_service_context() and not public.has_permission('pages.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_page from public.pages where id = p_page_id;
  if not found then
    raise exception 'page_not_found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('page_revision:' || p_page_id::text));
  select coalesce(max(revision_number), 0) + 1 into v_next from public.page_revisions where page_id = p_page_id;
  insert into public.page_revisions (page_id, revision_number, title, snapshot, note, created_by)
  values (p_page_id, v_next, v_page.title,
          jsonb_build_object('title', v_page.title, 'slug', v_page.slug, 'summary', v_page.summary, 'body', v_page.body,
                             'seo_title', v_page.seo_title, 'seo_description', v_page.seo_description, 'status', v_page.status),
          left(p_note, 500), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.snapshot_page(uuid, text) from public, anon;
grant execute on function public.snapshot_page(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Trending topics (editorially curated; see docs/PRD.md §Trending)
-- ---------------------------------------------------------------------------
create table public.trending_topics (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  category_id uuid references public.categories (id) on delete cascade,
  tag_id uuid references public.tags (id) on delete cascade,
  href text check (href is null or href ~ '^/[^/]'),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (num_nonnulls(category_id, tag_id, href) = 1)
);
create index trending_topics_position_idx on public.trending_topics (position);

-- ---------------------------------------------------------------------------
-- Navigation
-- ---------------------------------------------------------------------------
create table public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null
);

create table public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.navigation_menus (id) on delete cascade,
  parent_id uuid references public.navigation_items (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  href text not null check (href ~ '^/' or href ~ '^https://'),
  position integer not null default 0,
  is_visible boolean not null default true,
  open_in_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index navigation_items_menu_idx on public.navigation_items (menu_id, parent_id, position);
create trigger navigation_items_touch before update on public.navigation_items for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Homepage builder: one working draft, one published version, archived history.
-- Section settings are JSON validated by the typed block schema in src/lib/homepage/blocks.ts.
-- ---------------------------------------------------------------------------
create type public.homepage_status as enum ('draft', 'published', 'archived');

create table public.homepage_configurations (
  id uuid primary key default gen_random_uuid(),
  status public.homepage_status not null,
  label text,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index homepage_one_draft on public.homepage_configurations (status) where status = 'draft';
create unique index homepage_one_published on public.homepage_configurations (status) where status = 'published';
create trigger homepage_configurations_touch before update on public.homepage_configurations for each row execute function public.touch_updated_at();

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null references public.homepage_configurations (id) on delete cascade,
  block_type text not null check (block_type in (
    'hero', 'trending_topics', 'breaking_news', 'featured_story', 'latest_articles', 'article_grid',
    'category_showcase', 'editors_picks', 'most_read', 'poll_showcase', 'community', 'regional_news',
    'newsletter', 'custom_cta', 'photo_of_day', 'quote_of_day', 'news_quiz')),
  position integer not null default 0,
  is_enabled boolean not null default true,
  title text check (char_length(title) <= 200),
  description text check (char_length(description) <= 600),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index homepage_sections_config_idx on public.homepage_sections (configuration_id, position);
create trigger homepage_sections_touch before update on public.homepage_sections for each row execute function public.touch_updated_at();

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
  insert into public.homepage_sections (configuration_id, block_type, position, is_enabled, title, description, settings)
  select v_new, block_type, position, is_enabled, title, description, settings
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
  insert into public.homepage_sections (configuration_id, block_type, position, is_enabled, title, description, settings)
  select v_draft, block_type, position, is_enabled, title, description, settings
  from public.homepage_sections where configuration_id = p_configuration_id;
  update public.homepage_configurations set updated_by = auth.uid() where id = v_draft;
end;
$$;
revoke all on function public.restore_homepage_to_draft(uuid) from public, anon;
grant execute on function public.restore_homepage_to_draft(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Redirects (SEO). Destinations are same-site paths or https URLs; validated again in the app.
-- ---------------------------------------------------------------------------
create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique check (source_path ~ '^/[^/]' and source_path !~ '\s' and char_length(source_path) <= 300),
  destination text not null check ((destination ~ '^/[^/]' or destination = '/' or destination ~ '^https://') and destination !~ '\s'),
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  is_active boolean not null default true,
  hit_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_path <> destination)
);
create trigger redirects_touch before update on public.redirects for each row execute function public.touch_updated_at();
create trigger redirects_audit after insert or update or delete on public.redirects for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.media_assets enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.locations enable row level security;
alter table public.articles enable row level security;
alter table public.article_contributors enable row level security;
alter table public.article_tags enable row level security;
alter table public.related_articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.pages enable row level security;
alter table public.page_revisions enable row level security;
alter table public.trending_topics enable row level security;
alter table public.navigation_menus enable row level security;
alter table public.navigation_items enable row level security;
alter table public.homepage_configurations enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.redirects enable row level security;

-- Media: metadata is public (files live in a public bucket under unguessable paths; see SECURITY.md).
create policy media_read on public.media_assets for select to anon, authenticated using (true);
create policy media_insert on public.media_assets for insert to authenticated
  with check (public.has_permission('media.upload') and uploaded_by = auth.uid());
create policy media_update on public.media_assets for update to authenticated
  using (public.has_permission('media.manage_any') or (public.has_permission('media.upload') and uploaded_by = auth.uid()))
  with check (public.has_permission('media.manage_any') or (public.has_permission('media.upload') and uploaded_by = auth.uid()));
create policy media_delete on public.media_assets for delete to authenticated
  using (public.has_permission('media.manage_any') or (public.has_permission('media.upload') and uploaded_by = auth.uid()));

-- Taxonomy
create policy categories_read on public.categories for select to anon, authenticated using (is_active or public.is_staff());
create policy categories_write on public.categories for all to authenticated
  using (public.has_permission('taxonomy.manage')) with check (public.has_permission('taxonomy.manage'));
create policy tags_read on public.tags for select to anon, authenticated using (true);
create policy tags_write on public.tags for all to authenticated
  using (public.has_permission('taxonomy.manage')) with check (public.has_permission('taxonomy.manage'));
-- Writers may create tags while tagging their stories.
create policy tags_writer_insert on public.tags for insert to authenticated with check (public.has_permission('articles.create'));
create policy locations_read on public.locations for select to anon, authenticated using (is_active or public.is_staff());
create policy locations_write on public.locations for all to authenticated
  using (public.has_permission('taxonomy.manage')) with check (public.has_permission('taxonomy.manage'));

-- Articles
create policy articles_public_read on public.articles for select to anon, authenticated
  using (public.article_is_public(status, published_at));
create policy articles_staff_read on public.articles for select to authenticated
  using (public.has_permission('articles.view_all')
         or (public.is_staff() and author_id = auth.uid())
         or (public.is_staff() and exists (select 1 from public.article_contributors c where c.article_id = articles.id and c.profile_id = auth.uid())));
create policy articles_insert on public.articles for insert to authenticated
  with check (public.has_permission('articles.create')
              and (author_id = auth.uid() or public.has_permission('articles.edit_any')));
create policy articles_update on public.articles for update to authenticated
  using (public.has_permission('articles.edit_any')
         or (public.has_permission('articles.edit_own') and author_id = auth.uid() and status in ('draft', 'rejected')))
  with check (public.has_permission('articles.edit_any') or author_id = auth.uid());
create policy articles_delete on public.articles for delete to authenticated
  using (public.has_permission('articles.delete'));

create policy contributors_read on public.article_contributors for select to anon, authenticated
  using (public.can_view_article(article_id));
create policy contributors_write on public.article_contributors for all to authenticated
  using (public.can_edit_article(article_id)) with check (public.can_edit_article(article_id));
create policy article_tags_read on public.article_tags for select to anon, authenticated
  using (public.can_view_article(article_id));
create policy article_tags_write on public.article_tags for all to authenticated
  using (public.can_edit_article(article_id)) with check (public.can_edit_article(article_id));
create policy related_read on public.related_articles for select to anon, authenticated
  using (public.can_view_article(article_id));
create policy related_write on public.related_articles for all to authenticated
  using (public.can_edit_article(article_id)) with check (public.can_edit_article(article_id));
create policy revisions_read on public.article_revisions for select to authenticated
  using (public.is_staff() and public.can_view_article(article_id));

-- Public bylines: profiles credited on publicly visible articles.
create policy profiles_public_read on public.profiles for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.author_id = profiles.id and public.article_is_public(a.status, a.published_at))
         or exists (select 1 from public.article_contributors c join public.articles a on a.id = c.article_id
                    where c.profile_id = profiles.id and public.article_is_public(a.status, a.published_at)));

-- Pages
create policy pages_public_read on public.pages for select to anon, authenticated using (status = 'published');
create policy pages_staff on public.pages for all to authenticated
  using (public.has_permission('pages.manage')) with check (public.has_permission('pages.manage'));
create policy page_revisions_read on public.page_revisions for select to authenticated using (public.has_permission('pages.manage'));

-- Trending topics & navigation
create policy trending_read on public.trending_topics for select to anon, authenticated using (is_active or public.is_staff());
create policy trending_write on public.trending_topics for all to authenticated
  using (public.has_permission('taxonomy.manage')) with check (public.has_permission('taxonomy.manage'));
create policy nav_menus_read on public.navigation_menus for select to anon, authenticated using (true);
create policy nav_items_read on public.navigation_items for select to anon, authenticated using (is_visible or public.is_staff());
create policy nav_items_write on public.navigation_items for all to authenticated
  using (public.has_permission('navigation.manage')) with check (public.has_permission('navigation.manage'));

-- Homepage
create policy homepage_config_public on public.homepage_configurations for select to anon, authenticated
  using (status = 'published' or public.has_permission('homepage.manage'));
create policy homepage_config_write on public.homepage_configurations for update to authenticated
  using (public.has_permission('homepage.manage') and status = 'draft')
  with check (public.has_permission('homepage.manage') and status = 'draft');
create policy homepage_config_insert on public.homepage_configurations for insert to authenticated
  with check (public.has_permission('homepage.manage') and status = 'draft');
create policy homepage_sections_public on public.homepage_sections for select to anon, authenticated
  using (exists (select 1 from public.homepage_configurations c where c.id = configuration_id
                 and (c.status = 'published' or public.has_permission('homepage.manage'))));
create policy homepage_sections_write on public.homepage_sections for all to authenticated
  using (public.has_permission('homepage.manage')
         and exists (select 1 from public.homepage_configurations c where c.id = configuration_id and c.status = 'draft'))
  with check (public.has_permission('homepage.manage')
              and exists (select 1 from public.homepage_configurations c where c.id = configuration_id and c.status = 'draft'));

-- Redirects
create policy redirects_read on public.redirects for select to anon, authenticated using (is_active or public.has_permission('seo.manage'));
create policy redirects_write on public.redirects for all to authenticated
  using (public.has_permission('seo.manage')) with check (public.has_permission('seo.manage'));
