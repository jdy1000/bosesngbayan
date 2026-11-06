-- Boses ng Bayan — polls, community, moderation, newsletter, analytics, rate limiting.
-- Public write paths are service-role-only RPCs called from Next.js route handlers, which compute
-- hashed voter/network identifiers server-side. Anonymous clients cannot call them directly.

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, shared across server instances)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security; -- no policies: service role only

create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------
create type public.poll_status as enum ('draft', 'published', 'closed', 'archived');
create type public.poll_kind as enum ('single', 'multiple');
create type public.poll_results_visibility as enum ('always', 'after_vote', 'after_close', 'hidden');
create type public.poll_voting_policy as enum ('one_per_browser', 'one_per_browser_and_network');

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  question text not null check (char_length(question) between 5 and 300),
  description text check (char_length(description) <= 1000),
  kind public.poll_kind not null default 'single',
  max_choices integer not null default 1 check (max_choices between 1 and 20),
  status public.poll_status not null default 'draft',
  is_featured boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  results_visibility public.poll_results_visibility not null default 'after_vote',
  voting_policy public.poll_voting_policy not null default 'one_per_browser',
  methodology_note text check (char_length(methodology_note) <= 2000),
  category_id uuid references public.categories (id) on delete set null,
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  check (kind = 'multiple' or max_choices = 1)
);
create index polls_status_idx on public.polls (status, published_at desc);
create unique index polls_one_featured on public.polls (is_featured) where is_featured;

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_ballots (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  voter_hash text not null check (char_length(voter_hash) = 64),
  network_hash text check (network_hash is null or char_length(network_hash) = 64),
  created_at timestamptz not null default now(),
  unique (poll_id, voter_hash)
);
create index poll_ballots_network_idx on public.poll_ballots (poll_id, network_hash);
create index poll_ballots_created_idx on public.poll_ballots (created_at);

create table public.poll_votes (
  id bigint generated always as identity primary key,
  ballot_id uuid not null references public.poll_ballots (id) on delete cascade,
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ballot_id, option_id)
);
create index poll_votes_option_idx on public.poll_votes (poll_id, option_id);

create or replace function public.poll_has_votes(p_poll_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.poll_ballots where poll_id = p_poll_id);
$$;

create or replace function public.poll_is_open(p public.polls)
returns boolean language sql stable as $$
  select p.status = 'published'
     and (p.opens_at is null or p.opens_at <= now())
     and (p.closes_at is null or p.closes_at > now());
$$;

-- Integrity: once a poll has votes, its question meaning and options are frozen.
create or replace function public.polls_guard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if public.poll_has_votes(old.id) and (
       new.question is distinct from old.question
    or new.kind is distinct from old.kind
    or new.max_choices is distinct from old.max_choices
    or new.voting_policy is distinct from old.voting_policy) then
    raise exception 'poll_locked_after_votes' using errcode = '23514';
  end if;
  if new.status = 'published' and old.status <> 'published' then
    new.published_at := coalesce(old.published_at, now());
  end if;
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := now();
  end if;
  return new;
end;
$$;
create trigger polls_guard before update on public.polls for each row execute function public.polls_guard();
create trigger polls_audit after insert or update or delete on public.polls for each row execute function public.audit_row_change();

create or replace function public.poll_options_guard()
returns trigger language plpgsql as $$
declare
  v_poll uuid := coalesce(new.poll_id, old.poll_id);
begin
  if public.poll_has_votes(v_poll) then
    if tg_op = 'UPDATE' and new.label is not distinct from old.label and new.poll_id = old.poll_id then
      return new; -- reordering is harmless
    end if;
    raise exception 'poll_options_locked_after_votes' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger poll_options_guard before insert or update or delete on public.poll_options
  for each row execute function public.poll_options_guard();
create trigger poll_options_audit after insert or update or delete on public.poll_options
  for each row execute function public.audit_row_change();

-- Cast a vote. Returns {status: ok|already_voted|closed|invalid}.
create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[], p_voter_hash text, p_network_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.polls;
  v_options uuid[];
  v_ballot uuid;
  v_valid integer;
begin
  select * into p from public.polls where id = p_poll_id for share;
  if not found or p.status not in ('published', 'closed') then
    return jsonb_build_object('status', 'invalid');
  end if;
  if not public.poll_is_open(p) then
    return jsonb_build_object('status', 'closed');
  end if;
  select coalesce(array_agg(distinct o), '{}') into v_options from unnest(p_option_ids) o;
  if cardinality(v_options) < 1 or cardinality(v_options) > p.max_choices
     or (p.kind = 'single' and cardinality(v_options) <> 1) then
    return jsonb_build_object('status', 'invalid');
  end if;
  select count(*) into v_valid from public.poll_options where poll_id = p_poll_id and id = any (v_options);
  if v_valid <> cardinality(v_options) then
    return jsonb_build_object('status', 'invalid');
  end if;
  if char_length(coalesce(p_voter_hash, '')) <> 64 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if exists (select 1 from public.poll_ballots where poll_id = p_poll_id and voter_hash = p_voter_hash) then
    return jsonb_build_object('status', 'already_voted');
  end if;
  if p.voting_policy = 'one_per_browser_and_network' and p_network_hash is not null
     and exists (select 1 from public.poll_ballots where poll_id = p_poll_id and network_hash = p_network_hash) then
    return jsonb_build_object('status', 'already_voted');
  end if;
  begin
    insert into public.poll_ballots (poll_id, voter_hash, network_hash)
    values (p_poll_id, p_voter_hash, p_network_hash) returning id into v_ballot;
  exception when unique_violation then
    return jsonb_build_object('status', 'already_voted');
  end;
  insert into public.poll_votes (ballot_id, poll_id, option_id)
  select v_ballot, p_poll_id, o from unnest(v_options) o;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.cast_vote(uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid[], text, text) to service_role;

-- Results respecting the poll's visibility rule. Staff with polls.view_results always see results.
create or replace function public.get_poll_results(p_poll_id uuid, p_voter_hash text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p public.polls;
  v_has_voted boolean := false;
  v_visible boolean;
  v_closed boolean;
  v_total integer;
  v_options jsonb;
begin
  select * into p from public.polls where id = p_poll_id;
  if not found then
    return null;
  end if;
  if p.status not in ('published', 'closed', 'archived') and not public.has_permission('polls.view_results')
     and not public.has_permission('polls.manage') then
    return null;
  end if;
  if p_voter_hash is not null then
    v_has_voted := exists (select 1 from public.poll_ballots where poll_id = p_poll_id and voter_hash = p_voter_hash);
  end if;
  v_closed := p.status in ('closed', 'archived') or (p.closes_at is not null and p.closes_at <= now());
  v_visible := public.has_permission('polls.view_results')
    or p.results_visibility = 'always'
    or (p.results_visibility = 'after_close' and v_closed)
    or (p.results_visibility = 'after_vote' and (v_has_voted or v_closed));
  if not v_visible then
    return jsonb_build_object('visible', false, 'has_voted', v_has_voted, 'is_open', public.poll_is_open(p));
  end if;
  select count(*) into v_total from public.poll_ballots where poll_id = p_poll_id;
  select coalesce(jsonb_agg(jsonb_build_object('option_id', o.id, 'votes', coalesce(c.n, 0)) order by o.position), '[]'::jsonb)
    into v_options
  from public.poll_options o
  left join (select option_id, count(*) n from public.poll_votes where poll_id = p_poll_id group by option_id) c on c.option_id = o.id
  where o.poll_id = p_poll_id;
  return jsonb_build_object('visible', true, 'has_voted', v_has_voted, 'is_open', public.poll_is_open(p),
                            'total_ballots', v_total, 'options', v_options);
end;
$$;
revoke all on function public.get_poll_results(uuid, text) from public, anon;
grant execute on function public.get_poll_results(uuid, text) to authenticated, service_role;

-- Aggregate participation count shown in public trust copy (real data only).
create or replace function public.get_total_ballots()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.poll_ballots;
$$;
grant execute on function public.get_total_ballots() to anon, authenticated, service_role;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_ballots enable row level security;
alter table public.poll_votes enable row level security;

create policy polls_public_read on public.polls for select to anon, authenticated
  using (status in ('published', 'closed') or public.has_permission('polls.manage') or public.has_permission('polls.view_results'));
create policy polls_write on public.polls for all to authenticated
  using (public.has_permission('polls.manage')) with check (public.has_permission('polls.manage'));
create policy poll_options_read on public.poll_options for select to anon, authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id));
create policy poll_options_write on public.poll_options for all to authenticated
  using (public.has_permission('polls.manage')) with check (public.has_permission('polls.manage'));
-- Ballots & votes: no direct access; results go through get_poll_results(); exports through
-- the definer function below.

create or replace function public.export_poll_votes(p_poll_id uuid)
returns table (ballot_id uuid, voted_at timestamptz, option_label text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission('polls.view_results') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
    select b.id, b.created_at, o.label
    from public.poll_ballots b
    join public.poll_votes v on v.ballot_id = b.id
    join public.poll_options o on o.id = v.option_id
    where b.poll_id = p_poll_id
    order by b.created_at, o.position;
end;
$$;
revoke all on function public.export_poll_votes(uuid) from public, anon;
grant execute on function public.export_poll_votes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Community (Usap Bayan): submissions, comments, reports, moderation
-- ---------------------------------------------------------------------------
create type public.community_kind as enum ('perspective', 'question', 'discussion');
create type public.moderation_status as enum ('pending', 'approved', 'rejected', 'hidden', 'removed');
create type public.report_reason as enum ('spam', 'harassment', 'hate_speech', 'misinformation', 'violence', 'privacy', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  kind public.community_kind not null default 'perspective',
  title text not null check (char_length(title) between 5 and 200),
  body text not null check (char_length(body) between 20 and 5000),
  author_name text not null check (char_length(author_name) between 2 and 80),
  author_email extensions.citext check (author_email is null or author_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  author_location text check (char_length(author_location) <= 120),
  category_id uuid references public.categories (id) on delete set null,
  staff_author_id uuid references public.profiles (id) on delete set null,
  status public.moderation_status not null default 'pending',
  is_featured boolean not null default false,
  allow_comments boolean not null default true,
  network_hash text,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderator_note text check (char_length(moderator_note) <= 2000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_posts_status_idx on public.community_posts (status, published_at desc);
create trigger community_posts_touch before update on public.community_posts for each row execute function public.touch_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles (id) on delete cascade,
  community_post_id uuid references public.community_posts (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 80),
  author_email extensions.citext check (author_email is null or author_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  body text not null check (char_length(body) between 2 and 2000),
  status public.moderation_status not null default 'pending',
  network_hash text,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderator_note text check (char_length(moderator_note) <= 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(article_id, community_post_id) = 1)
);
create index comments_article_idx on public.comments (article_id, status, created_at);
create index comments_post_idx on public.comments (community_post_id, status, created_at);
create index comments_status_idx on public.comments (status, created_at desc);

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  community_post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  network_hash text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(community_post_id, comment_id) = 1)
);
create index moderation_reports_status_idx on public.moderation_reports (status, created_at desc);

create or replace function public.community_requires_moderation()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> 'moderation_enabled')::boolean from public.site_settings where key = 'community'), true);
$$;

create or replace function public.submit_community_post(
  p_kind public.community_kind, p_title text, p_body text, p_author_name text, p_author_email text,
  p_author_location text, p_category_id uuid, p_network_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status public.moderation_status := case when public.community_requires_moderation() then 'pending' else 'approved' end;
  v_id uuid;
begin
  if p_kind = 'discussion' then
    raise exception 'discussions_are_staff_only' using errcode = '22023';
  end if;
  insert into public.community_posts (kind, title, body, author_name, author_email, author_location, category_id, status, network_hash, published_at)
  values (p_kind, btrim(p_title), btrim(p_body), btrim(p_author_name), nullif(btrim(p_author_email), ''),
          nullif(btrim(p_author_location), ''), p_category_id, v_status, p_network_hash,
          case when v_status = 'approved' then now() end)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;
revoke all on function public.submit_community_post(public.community_kind, text, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_community_post(public.community_kind, text, text, text, text, text, uuid, text) to service_role;

create or replace function public.submit_comment(
  p_article_id uuid, p_post_id uuid, p_parent_id uuid, p_author_name text, p_author_email text, p_body text, p_network_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status public.moderation_status := case when public.community_requires_moderation() then 'pending' else 'approved' end;
  v_id uuid;
begin
  if p_article_id is not null then
    if not exists (select 1 from public.articles a where a.id = p_article_id and a.allow_comments
                   and public.article_is_public(a.status, a.published_at)) then
      raise exception 'comments_closed' using errcode = '22023';
    end if;
  elsif p_post_id is not null then
    if not exists (select 1 from public.community_posts c where c.id = p_post_id and c.status = 'approved' and c.allow_comments) then
      raise exception 'comments_closed' using errcode = '22023';
    end if;
  else
    raise exception 'target_required' using errcode = '22023';
  end if;
  if p_parent_id is not null and not exists (
      select 1 from public.comments c where c.id = p_parent_id and c.status = 'approved'
        and c.article_id is not distinct from p_article_id and c.community_post_id is not distinct from p_post_id) then
    raise exception 'parent_not_found' using errcode = '22023';
  end if;
  insert into public.comments (article_id, community_post_id, parent_id, author_name, author_email, body, status, network_hash)
  values (p_article_id, p_post_id, p_parent_id, btrim(p_author_name), nullif(btrim(p_author_email), ''), btrim(p_body), v_status, p_network_hash)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;
revoke all on function public.submit_comment(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_comment(uuid, uuid, uuid, text, text, text, text) to service_role;

create or replace function public.submit_report(p_post_id uuid, p_comment_id uuid, p_reason public.report_reason, p_details text, p_network_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_post_id is not null and not exists (select 1 from public.community_posts where id = p_post_id and status = 'approved') then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;
  if p_comment_id is not null and not exists (select 1 from public.comments where id = p_comment_id and status = 'approved') then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;
  insert into public.moderation_reports (community_post_id, comment_id, reason, details, network_hash)
  values (p_post_id, p_comment_id, p_reason, nullif(btrim(p_details), ''), p_network_hash)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_report(uuid, uuid, public.report_reason, text, text) from public, anon, authenticated;
grant execute on function public.submit_report(uuid, uuid, public.report_reason, text, text) to service_role;

-- Moderation actions with history.
create or replace function public.moderate_content(p_target_type text, p_target_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_from text;
  v_to public.moderation_status;
begin
  if not public.has_permission('moderation.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject', 'hide', 'remove', 'feature', 'unfeature', 'restore_pending') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  v_to := case p_action when 'approve' then 'approved' when 'reject' then 'rejected' when 'hide' then 'hidden'
                        when 'remove' then 'removed' when 'restore_pending' then 'pending' else null end;
  if p_target_type = 'community_post' then
    select status::text into v_from from public.community_posts where id = p_target_id for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if p_action in ('feature', 'unfeature') then
      if v_from <> 'approved' and p_action = 'feature' then
        raise exception 'only_approved_can_be_featured' using errcode = '22023';
      end if;
      update public.community_posts set is_featured = (p_action = 'feature'), moderated_by = auth.uid(), moderated_at = now()
      where id = p_target_id;
    else
      update public.community_posts set status = v_to, moderated_by = auth.uid(), moderated_at = now(),
        moderator_note = coalesce(nullif(btrim(p_note), ''), moderator_note),
        published_at = case when v_to = 'approved' then coalesce(published_at, now()) else published_at end,
        is_featured = case when v_to = 'approved' then is_featured else false end
      where id = p_target_id;
    end if;
  elsif p_target_type = 'comment' then
    if p_action in ('feature', 'unfeature') then
      raise exception 'invalid_action' using errcode = '22023';
    end if;
    select status::text into v_from from public.comments where id = p_target_id for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    update public.comments set status = v_to, moderated_by = auth.uid(), moderated_at = now(),
      moderator_note = coalesce(nullif(btrim(p_note), ''), moderator_note)
    where id = p_target_id;
  else
    raise exception 'invalid_target' using errcode = '22023';
  end if;
  insert into public.content_activity_logs (actor_id, entity_type, entity_id, action, from_status, to_status, note)
  values (auth.uid(), p_target_type, p_target_id, 'moderation:' || p_action, v_from, coalesce(v_to::text, v_from), left(nullif(btrim(p_note), ''), 2000));
end;
$$;
revoke all on function public.moderate_content(text, uuid, text, text) from public, anon;
grant execute on function public.moderate_content(text, uuid, text, text) to authenticated;

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
         resolved_by = case when p_status = 'open' then null else auth.uid() end,
         resolved_at = case when p_status = 'open' then null else now() end,
         resolution_note = nullif(btrim(p_note), '')
   where id = p_report_id;
  insert into public.content_activity_logs (actor_id, entity_type, entity_id, action, from_status, to_status, note)
  values (auth.uid(), 'report', p_report_id, 'report:' || p_status::text, v_from, p_status::text, left(nullif(btrim(p_note), ''), 2000));
end;
$$;
revoke all on function public.resolve_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.resolve_report(uuid, public.report_status, text) to authenticated;

alter table public.community_posts enable row level security;
alter table public.comments enable row level security;
alter table public.moderation_reports enable row level security;

create policy community_public_read on public.community_posts for select to anon, authenticated
  using (status = 'approved' or public.has_permission('moderation.manage'));
-- Staff-authored discussion topics.
create policy community_staff_insert on public.community_posts for insert to authenticated
  with check (public.has_permission('moderation.manage') and staff_author_id = auth.uid() and status = 'pending');
create policy community_staff_update on public.community_posts for update to authenticated
  using (public.has_permission('moderation.manage') and staff_author_id is not null)
  with check (public.has_permission('moderation.manage'));
create policy comments_public_read on public.comments for select to anon, authenticated
  using (status = 'approved' or public.has_permission('moderation.manage'));
create policy reports_read on public.moderation_reports for select to authenticated
  using (public.has_permission('moderation.manage'));

-- Private columns (emails, network hashes, moderator notes) are never readable by anonymous clients.
revoke select on public.community_posts from anon;
grant select (id, kind, title, body, author_name, author_location, category_id, status, is_featured, allow_comments, published_at, created_at)
  on public.community_posts to anon;
revoke select on public.comments from anon;
grant select (id, article_id, community_post_id, parent_id, author_name, body, status, created_at) on public.comments to anon;

-- ---------------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------------
create type public.subscriber_status as enum ('subscribed', 'unsubscribed', 'suppressed');

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  status public.subscriber_status not null default 'subscribed',
  consent_given boolean not null,
  consent_text text not null check (char_length(consent_text) <= 1000),
  consent_at timestamptz not null default now(),
  source text check (char_length(source) <= 80),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  suppressed_at timestamptz,
  suppression_reason text check (char_length(suppression_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consent_given)
);
create index newsletter_status_idx on public.newsletter_subscribers (status, subscribed_at desc);
create trigger newsletter_touch before update on public.newsletter_subscribers for each row execute function public.touch_updated_at();

create or replace function public.subscribe_newsletter(p_email text, p_consent_text text, p_source text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_existing public.newsletter_subscribers;
begin
  select * into v_existing from public.newsletter_subscribers where email = lower(btrim(p_email))::extensions.citext for update;
  if not found then
    insert into public.newsletter_subscribers (email, consent_given, consent_text, source)
    values (lower(btrim(p_email)), true, p_consent_text, left(p_source, 80));
    return 'subscribed';
  end if;
  if v_existing.status = 'suppressed' then
    return 'suppressed';
  end if;
  if v_existing.status = 'subscribed' then
    return 'already_subscribed';
  end if;
  update public.newsletter_subscribers
     set status = 'subscribed', consent_given = true, consent_text = p_consent_text, consent_at = now(),
         source = left(p_source, 80), subscribed_at = now(), unsubscribed_at = null
   where id = v_existing.id;
  return 'resubscribed';
end;
$$;
revoke all on function public.subscribe_newsletter(text, text, text) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text, text) to service_role;

create or replace function public.unsubscribe_newsletter(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.newsletter_subscribers set status = 'unsubscribed', unsubscribed_at = now()
   where unsubscribe_token = p_token and status = 'subscribed';
  return found or exists (select 1 from public.newsletter_subscribers where unsubscribe_token = p_token);
end;
$$;
revoke all on function public.unsubscribe_newsletter(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_newsletter(uuid) to service_role;

create or replace function public.set_subscriber_status(p_id uuid, p_status public.subscriber_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('newsletter.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.newsletter_subscribers set
    status = p_status,
    unsubscribed_at = case when p_status = 'unsubscribed' then now() else unsubscribed_at end,
    suppressed_at = case when p_status = 'suppressed' then now() when p_status = 'subscribed' then null else suppressed_at end,
    suppression_reason = case when p_status = 'suppressed' then nullif(btrim(p_reason), '') else suppression_reason end
  where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.write_audit('subscriber_status:' || p_status::text, 'newsletter_subscribers', p_id::text, jsonb_build_object('reason', p_reason));
end;
$$;
revoke all on function public.set_subscriber_status(uuid, public.subscriber_status, text) from public, anon;
grant execute on function public.set_subscriber_status(uuid, public.subscriber_status, text) to authenticated;

alter table public.newsletter_subscribers enable row level security;
create policy newsletter_read on public.newsletter_subscribers for select to authenticated using (public.has_permission('newsletter.view'));
create policy newsletter_delete on public.newsletter_subscribers for delete to authenticated using (public.has_permission('newsletter.manage'));
create trigger newsletter_delete_audit after delete on public.newsletter_subscribers for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Analytics: page views. visitor_hash = HMAC(daily salt, ip + user agent) computed server-side;
-- raw IPs and user agents are never stored. Bots are filtered before insert.
-- ---------------------------------------------------------------------------
create table public.page_view_events (
  id bigint generated always as identity primary key,
  path text not null check (char_length(path) <= 500),
  article_id uuid references public.articles (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  referrer_host text check (char_length(referrer_host) <= 255),
  created_at timestamptz not null default now()
);
create index page_views_created_idx on public.page_view_events (created_at);
create index page_views_article_idx on public.page_view_events (article_id, created_at);
create index page_views_visitor_idx on public.page_view_events (visitor_hash, path, created_at desc);
alter table public.page_view_events enable row level security; -- no policies; read via definer functions

create or replace function public.record_page_view(p_path text, p_article_id uuid, p_visitor_hash text, p_referrer_host text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_category uuid;
begin
  -- Deduplicate: same visitor + path within 30 minutes counts once.
  if exists (select 1 from public.page_view_events where visitor_hash = p_visitor_hash and path = p_path
             and created_at > now() - interval '30 minutes') then
    return false;
  end if;
  if p_article_id is not null then
    select category_id into v_category from public.articles a
     where a.id = p_article_id and public.article_is_public(a.status, a.published_at);
    if not found then
      p_article_id := null;
    end if;
  end if;
  insert into public.page_view_events (path, article_id, category_id, visitor_hash, referrer_host)
  values (left(p_path, 500), p_article_id, v_category, p_visitor_hash, left(nullif(p_referrer_host, ''), 255));
  return true;
end;
$$;
revoke all on function public.record_page_view(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_page_view(text, uuid, text, text) to service_role;

-- Most-read public articles (ids only), used by public "Most read" blocks.
create or replace function public.get_most_read_article_ids(p_days integer, p_limit integer, p_category_id uuid default null)
returns table (article_id uuid, views bigint) language sql stable security definer set search_path = public as $$
  select e.article_id, count(*) as views
  from public.page_view_events e
  join public.articles a on a.id = e.article_id
  where e.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))
    and public.article_is_public(a.status, a.published_at)
    and (p_category_id is null or a.category_id = p_category_id)
  group by e.article_id
  order by views desc, max(e.created_at) desc
  limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.get_most_read_article_ids(integer, integer, uuid) to anon, authenticated, service_role;

-- View counts for Studio article lists.
create or replace function public.get_article_view_counts(p_article_ids uuid[])
returns table (article_id uuid, views bigint) language sql stable security definer set search_path = public as $$
  select e.article_id, count(*) from public.page_view_events e
  where public.is_staff() and e.article_id = any (p_article_ids)
  group by e.article_id;
$$;
revoke all on function public.get_article_view_counts(uuid[]) from public, anon;
grant execute on function public.get_article_view_counts(uuid[]) to authenticated;

-- Dashboard/analytics aggregate. Range is [p_from, p_to). Dates bucketed in Asia/Manila.
create or replace function public.analytics_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.has_permission('analytics.view') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'page_views', (select count(*) from public.page_view_events where created_at >= p_from and created_at < p_to),
    'daily_unique_visitors_sum', (select count(*) from (select distinct visitor_hash, (created_at at time zone 'Asia/Manila')::date
                                   from public.page_view_events where created_at >= p_from and created_at < p_to) d),
    'poll_ballots', (select count(*) from public.poll_ballots where created_at >= p_from and created_at < p_to),
    'new_subscribers', (select count(*) from public.newsletter_subscribers where subscribed_at >= p_from and subscribed_at < p_to and status = 'subscribed'),
    'articles_published', (select count(*) from public.articles where first_published_at >= p_from and first_published_at < p_to),
    'views_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'views', n, 'visitors', u) order by d) from (
        select (created_at at time zone 'Asia/Manila')::date d, count(*) n, count(distinct visitor_hash) u
        from public.page_view_events where created_at >= p_from and created_at < p_to group by 1) x), '[]'::jsonb),
    'ballots_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'ballots', n) order by d) from (
        select (created_at at time zone 'Asia/Manila')::date d, count(*) n
        from public.poll_ballots where created_at >= p_from and created_at < p_to group by 1) x), '[]'::jsonb),
    'subscribers_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'subscribers', n) order by d) from (
        select (subscribed_at at time zone 'Asia/Manila')::date d, count(*) n
        from public.newsletter_subscribers where subscribed_at >= p_from and subscribed_at < p_to group by 1) x), '[]'::jsonb),
    'published_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'articles', n) order by d) from (
        select (first_published_at at time zone 'Asia/Manila')::date d, count(*) n
        from public.articles where first_published_at >= p_from and first_published_at < p_to group by 1) x), '[]'::jsonb),
    'top_articles', coalesce((select jsonb_agg(jsonb_build_object('article_id', a.id, 'title', a.title, 'slug', a.slug, 'views', x.n) order by x.n desc) from (
        select article_id, count(*) n from public.page_view_events
        where created_at >= p_from and created_at < p_to and article_id is not null
        group by article_id order by n desc limit 10) x join public.articles a on a.id = x.article_id), '[]'::jsonb),
    'top_categories', coalesce((select jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'views', x.n) order by x.n desc) from (
        select category_id, count(*) n from public.page_view_events
        where created_at >= p_from and created_at < p_to and category_id is not null
        group by category_id order by n desc limit 10) x join public.categories c on c.id = x.category_id), '[]'::jsonb),
    'top_referrers', coalesce((select jsonb_agg(jsonb_build_object('host', h, 'views', n) order by n desc) from (
        select coalesce(referrer_host, '(direkta)') h, count(*) n from public.page_view_events
        where created_at >= p_from and created_at < p_to group by 1 order by n desc limit 10) x), '[]'::jsonb),
    'top_polls', coalesce((select jsonb_agg(jsonb_build_object('poll_id', p.id, 'question', p.question, 'ballots', x.n) order by x.n desc) from (
        select poll_id, count(*) n from public.poll_ballots where created_at >= p_from and created_at < p_to
        group by poll_id order by n desc limit 10) x join public.polls p on p.id = x.poll_id), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.analytics_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.analytics_summary(timestamptz, timestamptz) to authenticated;

-- Retention: page views older than 13 months and stale rate-limit windows.
create or replace function public.purge_old_analytics()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not public.is_service_context() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.page_view_events where created_at < now() - interval '13 months';
  get diagnostics n = row_count;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n;
end;
$$;
revoke all on function public.purge_old_analytics() from public, anon, authenticated;
grant execute on function public.purge_old_analytics() to service_role;
