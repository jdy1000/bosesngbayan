/**
 * DEVELOPMENT-ONLY demo content. Usage: pnpm seed:demo   (after `supabase start` + `supabase db reset`)
 *
 * Refuses to run against anything but a local Supabase URL. Everything it creates is labelled demo:
 * article titles start with "[Demo]", bodies say the story is not real news, demo staff use the
 * reserved `.test` domain, and polls start with ZERO votes (no fabricated results).
 * Photos come from supabase/seed-media with their credits (CREDITS.json → media credit field).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { renderRichText } from "../src/lib/rich-text/render";

config({ path: ".env.local" });
config();

type Db = SupabaseClient<Database>;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || `Demo-${randomUUID().slice(0, 12)}`;

function assertLocal() {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error(`Refusing to seed demo content into non-local Supabase (${host || "no URL"}).`);
  }
  if (!anonKey || !serviceKey) throw new Error("Anon and service-role keys are required (see .env.example).");
}

const STAFF = [
  { email: "editor@bosesngbayan.test", name: "Demo Editor", role: "editor" },
  { email: "writer@bosesngbayan.test", name: "Demo Writer", role: "writer" },
  { email: "moderator@bosesngbayan.test", name: "Demo Moderator", role: "moderator" },
  { email: "analyst@bosesngbayan.test", name: "Demo Analyst", role: "analyst" },
  { email: "admin@bosesngbayan.test", name: "Demo Administrator", role: "administrator" },
] as const;

async function ensureStaff(admin: Db) {
  const ids: Record<string, string> = {};
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  for (const s of STAFF) {
    let user = list.users.find((u) => u.email === s.email);
    if (!user) {
      const created = await admin.auth.admin.createUser({ email: s.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { display_name: s.name } });
      if (created.error || !created.data.user) throw created.error;
      user = created.data.user;
    } else {
      await admin.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD });
    }
    const { error: roleError } = await admin.rpc("set_user_role", { p_user_id: user.id, p_role: s.role });
    if (roleError) throw roleError;
    ids[s.role] = user.id;
  }
  return ids;
}

async function signIn(email: string): Promise<Db> {
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return client;
}

interface Credit {
  file: string;
  photographer: string;
  source_page: string;
  license: string;
  alt_text_fil: string;
}

async function uploadMedia(editor: Db, editorId: string) {
  const dir = path.join(process.cwd(), "supabase", "seed-media");
  const credits = JSON.parse(await readFile(path.join(dir, "CREDITS.json"), "utf8")) as Credit[];
  const ids: Record<string, string> = {};
  for (const c of credits) {
    const { data: existing } = await editor.from("media_assets").select("id").eq("file_name", c.file).maybeSingle();
    if (existing) {
      ids[c.file] = existing.id;
      continue;
    }
    const bytes = await readFile(path.join(dir, c.file));
    const storagePath = `${editorId}/${randomUUID()}-${c.file}`;
    const up = await editor.storage.from("media").upload(storagePath, bytes, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    const { data, error } = await editor
      .from("media_assets")
      .insert({
        kind: "image",
        storage_path: storagePath,
        file_name: c.file,
        mime_type: "image/jpeg",
        size_bytes: bytes.byteLength,
        title: c.file.replace(/\.jpg$/, ""),
        alt_text: c.alt_text_fil,
        credit: `${c.photographer} / ${c.license}`,
        folder: "demo",
        uploaded_by: editorId,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids[c.file] = data.id;
  }
  return ids;
}

const DEMO_NOTE = "Halimbawang nilalaman lamang ito para sa development — hindi ito tunay na balita.";

function doc(paragraphs: string[]) {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", marks: [{ type: "italic" }], text: DEMO_NOTE }] },
      ...paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
    ],
  };
}

const ARTICLES: { slug: string; title: string; category: string; image: string; featured?: boolean; pick?: boolean; location?: string }[] = [
  { slug: "demo-ruta-ng-dyip", title: "[Demo] Paano naaapektuhan ng bagong ruta ang mga pasahero ng dyip", category: "transportasyon", image: "jeepney.jpg", featured: true, location: "ncr" },
  { slug: "demo-silid-aralan", title: "[Demo] Mga guro at magulang, nagbahagi ng pananaw sa bagong school year", category: "edukasyon", image: "classroom.jpg", pick: true },
  { slug: "demo-klinika-sa-barangay", title: "[Demo] Klinika sa barangay: ano ang kailangan ng komunidad?", category: "kalusugan", image: "healthcare.jpg", location: "western-visayas" },
  { slug: "demo-palengke", title: "[Demo] Sa palengke, presyo ng bilihin ang laging usapan", category: "ekonomiya", image: "market.jpg", pick: true },
  { slug: "demo-trabaho-sa-lungsod", title: "[Demo] Mga manggagawa sa lungsod, naghahanap ng mas maikling biyahe", category: "trabaho", image: "office-workers.jpg" },
  { slug: "demo-palayan", title: "[Demo] Tag-ani sa palayan: kuwento ng mga magsasaka", category: "komunidad", image: "rice-field.jpg", location: "central-luzon" },
  { slug: "demo-pantalan", title: "[Demo] Sa pantalan ng isang bayang baybayin, maagang nagsisimula ang araw", category: "pilipinas", image: "coastal-town.jpg", location: "eastern-visayas" },
  { slug: "demo-pagtitipon", title: "[Demo] Mga mamamayan, nagtipon para sa pampublikong konsultasyon", category: "pulitika", image: "crowd-flag.jpg", pick: true },
  { slug: "demo-kabataan", title: "[Demo] Kabataang boluntaryo, tumutulong sa programa ng barangay", category: "komunidad", image: "hero-community.jpg", location: "davao-region" },
  { slug: "demo-makati", title: "[Demo] Mga negosyo sa sentro ng lungsod, naghahanda sa bagong taon ng piskal", category: "business", image: "manila-skyline.jpg", location: "ncr" },
  { slug: "demo-ani-at-presyo", title: "[Demo] Ani at presyo: paano umaabot ang bigas mula bukid hanggang mesa", category: "ekonomiya", image: "rice-field.jpg", pick: true },
  { slug: "demo-online-na-klase", title: "[Demo] Ang papel ng teknolohiya sa silid-aralan ngayon", category: "teknolohiya", image: "classroom.jpg" },
  { slug: "demo-health-center", title: "[Demo] Health center sa probinsya, pinalawak ang oras ng serbisyo", category: "kalusugan", image: "healthcare.jpg", location: "northern-mindanao" },
];

async function seedArticles(editor: Db, writerId: string, media: Record<string, string>) {
  const { data: cats, error } = await editor.from("categories").select("id, slug");
  if (error) throw error;
  const { data: locs, error: locError } = await editor.from("locations").select("id, slug");
  if (locError) throw locError;
  const ids: string[] = [];
  for (const a of ARTICLES) {
    const { data: existing } = await editor.from("articles").select("id").eq("slug", a.slug).maybeSingle();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const rendered = renderRichText(
      doc([
        "Ang artikulong ito ay ginawa para masubukan ang layout, editorial workflow at mga homepage block ng Boses ng Bayan.",
        "Palitan ito ng tunay na ulat mula sa newsroom bago ilunsad ang site.",
      ]),
    );
    const { data, error: insertError } = await editor
      .from("articles")
      .insert({
        slug: a.slug,
        title: a.title,
        excerpt: DEMO_NOTE,
        body: rendered.doc as never,
        body_html: rendered.html,
        body_text: rendered.text,
        reading_minutes: rendered.readingMinutes,
        author_id: writerId,
        category_id: cats.find((c) => c.slug === a.category)?.id ?? null,
        featured_image_id: media[a.image] ?? null,
        location_id: a.location ? (locs.find((l) => l.slug === a.location)?.id ?? null) : null,
        source_attribution: "Demo content",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    for (const to of ["pending_review", "approved", "published"] as const) {
      const { error: tError } = await editor.rpc("transition_article", { p_article_id: data.id, p_to: to, p_note: "Demo seed" });
      if (tError) throw tError;
    }
    if (a.featured || a.pick) {
      const { error: flagError } = await editor.from("articles").update({ is_featured: Boolean(a.featured), is_editors_pick: Boolean(a.pick) }).eq("id", data.id);
      if (flagError) throw flagError;
    }
    ids.push(data.id);
  }
  return ids;
}

async function seedPolls(editor: Db) {
  const polls = [
    {
      slug: "demo-pinakamahalagang-isyu",
      question: "[Demo] Ano ang pinakamahalagang isyu sa inyong lugar ngayon?",
      options: ["Transportasyon", "Presyo ng bilihin", "Trabaho", "Kalusugan"],
      featured: true,
    },
    {
      slug: "demo-paraan-ng-pagbiyahe",
      question: "[Demo] Paano ka kadalasang bumibiyahe papasok sa trabaho o paaralan?",
      options: ["Dyip", "Bus o tren", "Motorsiklo", "Naglalakad o bisikleta"],
      featured: false,
    },
  ];
  const ids: string[] = [];
  for (const p of polls) {
    let { data: row } = await editor.from("polls").select("id").eq("slug", p.slug).maybeSingle();
    if (!row) {
      const ins = await editor
        .from("polls")
        .insert({ slug: p.slug, question: p.question, results_visibility: "after_vote", methodology_note: DEMO_NOTE })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      row = ins.data;
      const opts = await editor.from("poll_options").insert(p.options.map((label, i) => ({ poll_id: row!.id, label, position: i + 1 })));
      if (opts.error) throw opts.error;
    }
    const pub = await editor
      .from("polls")
      .update({ status: "published", published_at: new Date().toISOString(), is_featured: p.featured })
      .eq("id", row.id);
    if (pub.error) throw pub.error;
    ids.push(row.id);
  }
  return ids;
}

async function seedPages(editor: Db) {
  const { data: pages, error } = await editor.from("pages").select("id, title, status");
  if (error) throw error;
  for (const page of pages) {
    if (page.status === "published") continue;
    const rendered = renderRichText(doc([`Ito ang pahinang “${page.title}”. Palitan ito ng opisyal na nilalaman mula sa Studio → Mga Pahina.`]));
    const { error: upError } = await editor
      .from("pages")
      .update({ body: rendered.doc as never, body_html: rendered.html, status: "published", published_at: new Date().toISOString() })
      .eq("id", page.id);
    if (upError) throw upError;
  }
}

async function wireHomepage(editor: Db, media: Record<string, string>, pollId: string) {
  const { data: draft, error } = await editor.from("homepage_configurations").select("id").eq("status", "draft").single();
  if (error) throw error;
  const { data: sections } = await editor.from("homepage_sections").select("id, block_type, settings").eq("configuration_id", draft.id);
  for (const s of sections ?? []) {
    const settings = s.settings as Record<string, unknown>;
    if (s.block_type === "hero") settings.image_id = media["hero-community.jpg"] ?? null;
    else if (s.block_type === "poll_showcase") settings.poll_id = pollId;
    else if (s.block_type === "custom_cta" && settings.variant === "banner") settings.image_id = media["crowd-flag.jpg"] ?? null;
    else continue;
    if (s.block_type === "hero") settings.poll_id = pollId;
    const { error: upError } = await editor.from("homepage_sections").update({ settings: settings as Database["public"]["Tables"]["homepage_sections"]["Update"]["settings"] }).eq("id", s.id);
    if (upError) throw upError;
  }
  const { error: pubError } = await editor.rpc("publish_homepage");
  if (pubError) throw pubError;
}

async function main() {
  assertLocal();
  const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const staff = await ensureStaff(admin);
  const editor = await signIn("editor@bosesngbayan.test");
  const media = await uploadMedia(editor, staff.editor!);
  const articles = await seedArticles(editor, staff.writer!, media);
  const polls = await seedPolls(editor);
  await seedPages(editor);
  await wireHomepage(editor, media, polls[0]!);
  process.stdout.write(
    [
      "Demo content ready (local only).",
      `  ${articles.length} demo articles, ${polls.length} demo polls (0 votes), ${Object.keys(media).length} media assets.`,
      `  Demo staff password: ${DEMO_PASSWORD}`,
      ...STAFF.map((s) => `  ${s.role.padEnd(13)} ${s.email}`),
      "Create the Owner separately with: pnpm bootstrap:owner --email you@example.com",
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`seed-demo failed: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
  process.exit(1);
});
