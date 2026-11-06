/**
 * One-time Owner bootstrap. Usage:
 *   pnpm bootstrap:owner --email owner@example.com --name "Pangalan ng Owner"
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local or the shell).
 * Refuses to run when an active Owner already exists — later owners are promoted from Studio by an
 * existing Owner. Creates the Auth user with a random temporary password shown ONCE in this terminal;
 * sign in at /admin/login and change it immediately (or use "Nakalimutan ang password?").
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Owner";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Pass --email <address>.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: owners, error: ownerError } = await admin.from("user_roles").select("user_id").eq("role", "owner").limit(1);
  if (ownerError) throw ownerError;
  if (owners && owners.length > 0) {
    throw new Error("An Owner already exists. Ask the existing Owner to promote additional owners in Studio → Team.");
  }

  // Suffix guarantees the Auth password policy (lower + upper + digit) regardless of the random part.
  const tempPassword = `${randomBytes(18).toString("base64url")}Aa7`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (createError || !created.user) throw createError ?? new Error("User creation failed.");

  const { error: roleError } = await admin.rpc("set_user_role", { p_user_id: created.user.id, p_role: "owner" });
  if (roleError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw roleError;
  }
  await admin.rpc("write_audit", {
    p_action: "owner.bootstrap",
    p_entity_type: "user",
    p_entity_id: created.user.id,
    p_details: { via: "scripts/bootstrap-owner.ts" },
  });

  process.stdout.write(
    [
      "",
      "Owner created.",
      `  Email:              ${email}`,
      `  Temporary password: ${tempPassword}`,
      "",
      "This password is shown only once. Sign in at /admin/login and change it immediately.",
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`bootstrap-owner failed: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
  process.exit(1);
});
