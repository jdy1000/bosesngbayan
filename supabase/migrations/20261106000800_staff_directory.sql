-- Boses ng Bayan — Studio team directory.
-- Staff emails and sign-in timestamps live in auth.users, which API roles cannot read. This
-- definer function exposes only those fields, only for staff rows, only to users.view holders.
-- Columns are read through to_jsonb so the function also works against minimal auth stubs.
-- Rollback: drop function public.staff_directory();

create or replace function public.staff_directory()
returns table (user_id uuid, email text, invited_at timestamptz, confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id,
         u.email::text,
         nullif(to_jsonb(u) ->> 'invited_at', '')::timestamptz,
         nullif(to_jsonb(u) ->> 'email_confirmed_at', '')::timestamptz,
         nullif(to_jsonb(u) ->> 'last_sign_in_at', '')::timestamptz
  from auth.users u
  join public.user_roles ur on ur.user_id = u.id
  where public.has_permission('users.view');
$$;
revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated, service_role;
