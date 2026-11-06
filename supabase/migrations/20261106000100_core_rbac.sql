-- Boses ng Bayan — core identity, RBAC, settings and audit.
-- Rollback: drop the objects created here in reverse order (see docs/DATABASE_SCHEMA.md).

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Roles & permissions
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'administrator', 'editor', 'writer', 'moderator', 'analyst');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text check (char_length(title) <= 120),
  bio text check (char_length(bio) <= 2000),
  avatar_url text check (char_length(avatar_url) <= 2048),
  is_active boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now()
);
create index user_roles_role_idx on public.user_roles (role);

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  group_name text not null,
  description text not null
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

insert into public.permissions (key, group_name, description) values
  ('dashboard.view', 'Dashboard', 'Open Studio and view the dashboard'),
  ('articles.create', 'Articles', 'Create new articles'),
  ('articles.edit_own', 'Articles', 'Edit own articles while in draft or rejected'),
  ('articles.edit_any', 'Articles', 'Edit any article in any editable state'),
  ('articles.view_all', 'Articles', 'View all articles regardless of author'),
  ('articles.submit', 'Articles', 'Submit articles for editorial review'),
  ('articles.review', 'Articles', 'Approve or reject submitted articles'),
  ('articles.publish', 'Articles', 'Publish, schedule and unpublish articles; set homepage flags'),
  ('articles.archive', 'Articles', 'Archive and restore articles'),
  ('articles.delete', 'Articles', 'Permanently delete articles'),
  ('media.upload', 'Media', 'Upload media and edit own media'),
  ('media.manage_any', 'Media', 'Edit and delete any media asset'),
  ('taxonomy.manage', 'Taxonomy', 'Manage categories, tags, locations and trending topics'),
  ('pages.manage', 'Pages', 'Create, edit and publish static pages'),
  ('homepage.manage', 'Homepage', 'Edit and publish homepage configuration'),
  ('navigation.manage', 'Navigation', 'Edit header and footer navigation'),
  ('polls.manage', 'Polls', 'Create, edit, publish, close and archive polls'),
  ('polls.view_results', 'Polls', 'View poll results and export them'),
  ('moderation.manage', 'Community', 'Moderate submissions, comments and reports'),
  ('newsletter.view', 'Newsletter', 'View subscribers'),
  ('newsletter.manage', 'Newsletter', 'Suppress, unsubscribe and export subscribers'),
  ('analytics.view', 'Analytics', 'View analytics dashboards'),
  ('users.view', 'Team', 'View team members and roles'),
  ('users.manage', 'Team', 'Invite, change roles and deactivate team members'),
  ('settings.manage', 'Settings', 'Edit site settings'),
  ('seo.manage', 'SEO', 'Manage redirects and global SEO defaults'),
  ('audit.view', 'Audit', 'View audit logs'),
  ('roles.manage', 'Team', 'Edit the role permission matrix (owner only)');

-- Owner: everything.
insert into public.role_permissions (role, permission) select 'owner', key from public.permissions;
-- Administrator: everything except editing the permission matrix.
insert into public.role_permissions (role, permission)
  select 'administrator', key from public.permissions where key <> 'roles.manage';
insert into public.role_permissions (role, permission) values
  ('editor', 'dashboard.view'), ('editor', 'articles.create'), ('editor', 'articles.edit_own'),
  ('editor', 'articles.edit_any'), ('editor', 'articles.view_all'), ('editor', 'articles.submit'),
  ('editor', 'articles.review'), ('editor', 'articles.publish'), ('editor', 'articles.archive'),
  ('editor', 'media.upload'), ('editor', 'media.manage_any'), ('editor', 'taxonomy.manage'),
  ('editor', 'pages.manage'), ('editor', 'homepage.manage'), ('editor', 'polls.manage'),
  ('editor', 'polls.view_results'), ('editor', 'moderation.manage'), ('editor', 'analytics.view'),
  ('editor', 'users.view'),
  ('writer', 'dashboard.view'), ('writer', 'articles.create'), ('writer', 'articles.edit_own'),
  ('writer', 'articles.submit'), ('writer', 'media.upload'),
  ('moderator', 'dashboard.view'), ('moderator', 'moderation.manage'),
  ('analyst', 'dashboard.view'), ('analyst', 'analytics.view'), ('analyst', 'polls.view_results');

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so RLS policies can call them
-- without recursive policy evaluation). They only ever read auth.uid().
-- ---------------------------------------------------------------------------
-- True only for the service-role API key or a direct superuser session (migrations/seed).
-- Uses session_user, NOT current_user: inside SECURITY DEFINER functions current_user is the
-- function owner, which would otherwise make every definer RPC look privileged.
create or replace function public.is_service_context()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (auth.jwt() is null and session_user in ('postgres', 'supabase_admin'));
$$;

create or replace function public.auth_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select ur.role from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.is_active;
$$;

create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = auth.uid() and p.is_active and rp.permission = perm
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_app_role() is not null;
$$;

create or replace function public.my_permissions()
returns setof text language sql stable security definer set search_path = public as $$
  select rp.permission from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join public.role_permissions rp on rp.role = ur.role
  where ur.user_id = auth.uid() and p.is_active;
$$;

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit & activity logs (append-only; written by triggers / definer RPCs)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.content_activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);
create index content_activity_entity_idx on public.content_activity_logs (entity_type, entity_id, created_at desc);
create index content_activity_created_idx on public.content_activity_logs (created_at desc);

create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.write_audit(text, text, text, jsonb) to authenticated, service_role;

create or replace function public.write_activity(p_entity_type text, p_entity_id uuid, p_action text, p_from text, p_to text, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into public.content_activity_logs (actor_id, entity_type, entity_id, action, from_status, to_status, note)
  values (auth.uid(), p_entity_type, p_entity_id, p_action, p_from, p_to, p_note);
$$;
revoke all on function public.write_activity(text, uuid, text, text, text, text) from public, anon, authenticated;

-- Generic row audit trigger for sensitive tables.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_details jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key', to_jsonb(old) ->> 'user_id');
    v_details := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'user_id');
    v_details := jsonb_build_object('new', to_jsonb(new));
  else
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'user_id');
    v_details := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;
  -- Never copy large rich-text bodies into the audit trail.
  v_details := v_details #- '{old,body}' #- '{new,body}' #- '{old,body_html}' #- '{new,body_html}'
                         #- '{old,body_text}' #- '{new,body_text}' #- '{old,search_vector}' #- '{new,search_vector}';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_details);
  return coalesce(new, old);
end;
$$;

create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();
create trigger role_permissions_audit after insert or delete on public.role_permissions
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- New auth user → profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Staff'), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Team management RPCs (all invariants enforced here, not in the client)
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller_role public.app_role := public.auth_app_role();
  v_current public.app_role;
begin
  if not public.is_service_context() then
    if not public.has_permission('users.manage') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if p_user_id = auth.uid() then
      raise exception 'cannot_change_own_role' using errcode = '42501';
    end if;
    select role into v_current from public.user_roles where user_id = p_user_id;
    if (p_role = 'owner' or v_current = 'owner') and v_caller_role <> 'owner' then
      raise exception 'owner_role_protected' using errcode = '42501';
    end if;
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role, assigned_by, assigned_at)
  values (p_user_id, p_role, auth.uid(), now())
  on conflict (user_id) do update set role = excluded.role, assigned_by = excluded.assigned_by, assigned_at = now();
  if not exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role = 'owner' and p.is_active) then
    raise exception 'at_least_one_owner_required' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.set_user_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.app_role;
begin
  if not public.is_service_context() then
    if not public.has_permission('users.manage') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if p_user_id = auth.uid() then
      raise exception 'cannot_deactivate_self' using errcode = '42501';
    end if;
    select role into v_target from public.user_roles where user_id = p_user_id;
    if v_target = 'owner' and public.auth_app_role() <> 'owner' then
      raise exception 'owner_role_protected' using errcode = '42501';
    end if;
  end if;
  update public.profiles
     set is_active = p_active, deactivated_at = case when p_active then null else now() end
   where id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role = 'owner' and p.is_active) then
    raise exception 'at_least_one_owner_required' using errcode = '23514';
  end if;
  perform public.write_audit(case when p_active then 'reactivate' else 'deactivate' end, 'profiles', p_user_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.set_user_active(uuid, boolean) from public, anon;
grant execute on function public.set_user_active(uuid, boolean) to authenticated, service_role;

create or replace function public.set_role_permission(p_role public.app_role, p_permission text, p_granted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_context() and not public.has_permission('roles.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'owner_permissions_locked' using errcode = '42501';
  end if;
  if p_permission = 'roles.manage' then
    raise exception 'roles_manage_owner_only' using errcode = '42501';
  end if;
  if p_granted then
    insert into public.role_permissions (role, permission) values (p_role, p_permission) on conflict do nothing;
  else
    delete from public.role_permissions where role = p_role and permission = p_permission;
  end if;
end;
$$;
revoke all on function public.set_role_permission(public.app_role, text, boolean) from public, anon;
grant execute on function public.set_role_permission(public.app_role, text, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Site settings (typed per key in the application layer; never secrets)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key check (key in ('general', 'social', 'contact', 'seo', 'footer', 'publication', 'community', 'newsletter')),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();
create trigger site_settings_audit after insert or update or delete on public.site_settings
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.content_activity_logs enable row level security;
alter table public.site_settings enable row level security;

-- Profiles: staff see each other; the public sees only profiles credited on public content
-- (policy defined in the content migration once articles exist). Users edit their own profile.
create policy profiles_staff_read on public.profiles for select to authenticated
  using (public.is_staff() or id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

-- is_active may only change through set_user_active(). Direct API updates run as the
-- `authenticated` role; the definer RPC runs as the table owner, so current_user tells them apart.
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  if (new.is_active is distinct from old.is_active or new.deactivated_at is distinct from old.deactivated_at)
     and current_user in ('authenticated', 'anon') then
    raise exception 'use_set_user_active' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.view'));
-- No direct insert/update/delete policies: changes go through set_user_role().

create policy permissions_read on public.permissions for select to authenticated using (public.is_staff());
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.is_staff());

create policy audit_read on public.audit_logs for select to authenticated using (public.has_permission('audit.view'));
create policy activity_read on public.content_activity_logs for select to authenticated using (public.is_staff());

create policy settings_public_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
