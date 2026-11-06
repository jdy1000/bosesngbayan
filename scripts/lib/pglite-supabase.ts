/**
 * Docker-free Supabase-compatible Postgres for tests and type generation.
 *
 * Boots PGlite (real Postgres compiled to WASM), installs minimal stand-ins for the parts of the
 * Supabase platform our migrations depend on (roles anon/authenticated/service_role, auth.users,
 * auth.uid()/auth.jwt(), storage.buckets/objects/foldername, default grants), then applies every
 * migration in supabase/migrations and supabase/seed.sql exactly as written.
 *
 * Limits: no PostgREST, GoTrue or Storage API — HTTP-level behavior is covered by e2e tests
 * against a real Supabase stack (see docs/TESTING_STRATEGY.md).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const PLATFORM_STUBS = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
`;

export function repoPath(...parts: string[]): string {
  // Scripts and tests are always run from the repository root (package.json scripts / vitest).
  return join(process.cwd(), ...parts);
}

export function migrationFiles(): string[] {
  const dir = repoPath("supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));
}

export async function createSupabaseLikeDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { citext, pg_trgm } });
  await db.exec(PLATFORM_STUBS);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`Migration failed: ${file}\n${(error as Error).message}`);
    }
  }
  if (opts.seed !== false) {
    await db.exec(readFileSync(repoPath("supabase", "seed.sql"), "utf8"));
  }
  return db;
}

export type DbRole = "anon" | "authenticated" | "service_role";

/** Run a function as a Supabase API role with the given JWT claims (like PostgREST does). */
export async function asRole<T>(db: PGlite, role: DbRole, userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

/** Create an auth user (+ profile via trigger) and optionally assign a role, as superuser. */
export async function createStaff(db: PGlite, email: string, role: string | null): Promise<string> {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('display_name', $2::text)) returning id",
    [email, email.split("@")[0]],
  );
  const id = res.rows[0]!.id;
  if (role) {
    await db.query("insert into public.user_roles (user_id, role) values ($1, $2::public.app_role)", [id, role]);
  }
  return id;
}
