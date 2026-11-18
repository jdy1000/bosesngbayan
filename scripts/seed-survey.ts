/**
 * Loads the client's first survey into a database: "Top-performing, most trusted vice mayors (National Capital Region)",
 * "Boses ng Bayan" Index of Governance (IOG) trust and performance ratings of November 11, 2026, 17 candidates.
 * The figures, names and cities are transcribed from the client's published graphic; the photos are cropped from it
 * (supabase/seed-media/surveys). Nothing here is invented.
 *
 * Usage (local stack):   SEED_ENV_FILE=.env.development.local pnpm seed:survey
 *        (hosted project): pnpm seed:survey   with SEED_SURVEY_REMOTE_HOST=<project host>   (refused otherwise)
 * Idempotent: a survey with the same title and release date is left alone. Uses the service-role key, so it runs
 * from a developer machine only, never from the app.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

// Read before the env file is loaded: the guard must come from the shell, not from a file that also holds the keys.
const allowedRemoteHost = process.env.SEED_SURVEY_REMOTE_HOST;
config({ path: process.env.SEED_ENV_FILE ?? ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
const isLocal = ["127.0.0.1", "localhost"].includes(host);

const SURVEY = {
  title: "Top-Performing, Most Trusted Vice Mayors",
  scope: "National Capital Region",
  subtitle: "“Boses ng Bayan” Index of Governance (IOG) – Trust & Performance Ratings",
  survey_date: "2026-11-11",
} as const;

// rank (the tile on the graphic), name as "First Last", city, overall %, trust %, performance %, photo file
const ENTRIES: [number, string, string, number, number, number, string][] = [
  [1, "Kid Peña", "Makati City", 87.3, 86.7, 87.9, "01-pena-kid.jpg"],
  [1, "Chi Atienza", "City of Manila", 86.8, 86.5, 87.2, "02-atienza-chi.jpg"],
  [2, "Gian Sotto", "Quezon City", 84.9, 84.3, 85.6, "03-sotto-gian.jpg"],
  [2, "Dodot Jaworski", "Pasig City", 84.5, 84.1, 85.0, "04-jaworski-dodot.jpg"],
  [2, "Mark Calixto", "Pasay City", 84.2, 83.7, 84.8, "05-calixto-mark.jpg"],
  [2, "Karina Teh-Limsico", "Caloocan City", 83.9, 83.5, 84.3, "06-teh-limsico-karina.jpg"],
  [2, "Benjo Bernabe", "Parañaque City", 83.5, 83.3, 83.8, "07-bernabe-benjo.jpg"],
  [2, "Tito Sanchez", "Navotas City", 83.3, 83.1, 83.5, "08-sanchez-tito.jpg"],
  [3, "Phanie Teves", "Muntinlupa City", 82.2, 81.8, 82.6, "09-teves-phanie.jpg"],
  [3, "Arvin Ian Alit", "Taguig City", 81.9, 81.5, 82.3, "10-alit-arvin-ian.jpg"],
  [3, "Imelda Aguilar", "Las Piñas City", 81.4, 81.3, 81.6, "11-aguilar-imelda.jpg"],
  [3, "Anthony Suva", "Mandaluyong City", 81.2, 81.1, 81.4, "12-suva-anthony.jpg"],
  [3, "Edward Nolasco", "Malabon City", 80.6, 80.0, 81.2, "13-nolasco-edward.jpg"],
  [4, "Marlon Alejandrino", "Valenzuela City", 78.7, 78.2, 79.3, "14-alejandrino-marlon.jpg"],
  [4, "Del De Guzman", "Marikina City", 77.6, 77.4, 77.8, "15-de-guzman-del.jpg"],
  [5, "AAA Agcaoili", "San Juan City", 76.9, 76.6, 77.2, "16-agcaoili-aaa.jpg"],
  [5, "Carlo Santos", "Municipality of Pateros", 75.8, 75.1, 76.5, "17-santos-carlo.jpg"],
];

async function main() {
  if (!isLocal && (!host || host !== allowedRemoteHost)) {
    throw new Error(`Refusing to write to non-local Supabase (${host || "no URL"}). Set SEED_SURVEY_REMOTE_HOST to its exact hostname to allow it.`);
  }
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const found = await db.from("surveys").select("id").eq("title", SURVEY.title).eq("survey_date", SURVEY.survey_date).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) {
    process.stdout.write(`Survey already loaded on ${host} (${found.data.id}); nothing to do.\n`);
    return;
  }

  // Photos are stored under a staff member's folder (the storage policy and path check expect <user-id>/<file>).
  const staff = await db.from("user_roles").select("user_id").in("role", ["owner", "administrator", "editor"]).limit(1).maybeSingle();
  if (staff.error) throw staff.error;
  if (!staff.data) throw new Error("No owner, administrator or editor exists yet. Create one first (pnpm bootstrap:owner).");
  const uploader = staff.data.user_id;

  const created = await db.from("surveys").insert({ ...SURVEY, is_published: false, show_on_homepage: true, created_by: uploader, updated_by: uploader }).select("id").single();
  if (created.error) throw created.error;
  const surveyId = created.data.id;

  const dir = path.join(process.cwd(), "supabase", "seed-media", "surveys");
  const rows: Database["public"]["Tables"]["survey_entries"]["Insert"][] = [];
  for (const [i, [rank, name, area, overall, trust, performance, file]] of ENTRIES.entries()) {
    const bytes = await readFile(path.join(dir, file));
    const storagePath = `${uploader}/${randomUUID()}-${file}`;
    const up = await db.storage.from("media").upload(storagePath, bytes, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    const asset = await db
      .from("media_assets")
      .insert({
        kind: "image",
        storage_path: storagePath,
        file_name: file,
        mime_type: "image/jpeg",
        size_bytes: bytes.byteLength,
        width: 372,
        height: 420,
        title: `${name} (survey photo)`,
        alt_text: `Larawan ni ${name}`,
        credit: "Boses ng Bayan IOG survey graphic, November 11, 2026",
        folder: "surveys",
        uploaded_by: uploader,
      })
      .select("id")
      .single();
    if (asset.error) throw asset.error;
    rows.push({ survey_id: surveyId, position: i * 10, rank_no: rank, name, area, overall_pct: overall, trust_pct: trust, performance_pct: performance, photo_id: asset.data.id });
  }
  const inserted = await db.from("survey_entries").insert(rows);
  if (inserted.error) throw inserted.error;
  // Published last: a run that stops half way leaves a draft, never a live survey with missing cards.
  const published = await db.from("surveys").update({ is_published: true }).eq("id", surveyId);
  if (published.error) throw published.error;
  process.stdout.write(`Loaded “${SURVEY.title}” with ${rows.length} candidates on ${host}.\n`);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : JSON.stringify(e)}\n`);
  process.exit(1);
});
