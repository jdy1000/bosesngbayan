import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "@/lib/database.types";

export type TypedSupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Session-aware client for Studio (admin) server components and server actions.
 * Runs as the signed-in user, so every query is subject to RLS.
 */
export async function createSessionClient() {
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}

/**
 * Anonymous client for the public website. Never carries a user session, so public pages only
 * ever see what RLS exposes to `anon` — drafts cannot leak even when an editor is signed in.
 */
export function createPublicClient(): TypedSupabaseClient {
  const env = publicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Privileged client. Server-only; used exclusively for the narrow service-role RPCs
 * (votes, subscriptions, submissions, page views, scheduler) and Auth admin calls
 * (invitations, bans) AFTER the caller's permission has been verified.
 */
export function createServiceClient(): TypedSupabaseClient {
  const env = publicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
