import "server-only";
import { z } from "zod";

/** Server-only secrets. Never import this module from client components. */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** HMAC key for voter / visitor / network hashes. Rotate to invalidate all hashes. */
  HASH_SECRET: z.string().min(32),
  /** Bearer token required by /api/cron/* routes. */
  CRON_SECRET: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    HASH_SECRET: process.env.HASH_SECRET,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid server environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
    );
  }
  cached = parsed.data;
  return cached;
}
