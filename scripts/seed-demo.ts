/**
 * DEVELOPMENT-ONLY preview content. Usage: pnpm seed:demo   (after `supabase start` + `supabase db reset`)
 *
 * Refuses to run against anything but a local Supabase URL, so none of this can reach production.
 * At the owner's request the content carries no visible "sample" labels (ADR-013), so it is written to be
 * harmless if mistaken for real: generic features with no real people, statistics, institutions or events;
 * staff bylines are newsroom desks on the reserved `.test` domain; polls start with ZERO votes.
 * Photos come from supabase/seed-media (CREDITS.json keeps provenance). All are CC0, public domain or
 * Unsplash License, so no credit line is shown; a photo with `credit_required: true` gets one.
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
  { email: "editor@bosesngbayan.test", name: "Editorial Desk", role: "editor" },
  { email: "writer@bosesngbayan.test", name: "Boses ng Bayan Newsroom", role: "writer" },
  { email: "moderator@bosesngbayan.test", name: "Community Desk", role: "moderator" },
  { email: "analyst@bosesngbayan.test", name: "Audience Desk", role: "analyst" },
  { email: "admin@bosesngbayan.test", name: "Site Administrator", role: "administrator" },
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
  credit_required: boolean; // false for CC0, public domain and Unsplash License photos
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
        caption: c.alt_text_fil, // Describes the photo only; captions never name real places or people.
        credit: c.credit_required ? `${c.photographer} / ${c.license}` : null,
        folder: "preview",
        uploaded_by: editorId,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids[c.file] = data.id;
  }
  return ids;
}

function doc(paragraphs: string[]) {
  return { type: "doc", content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
}

type SeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  category: string;
  image: string;
  featured?: boolean;
  pick?: boolean;
  location?: string;
};

// Local preview stories (owner request: no visible sample labels). They are generic features with no real
// people, statistics, institutions or events, and this script refuses to run against a non-local database.
const ARTICLES: SeedArticle[] = [
  {
    slug: "pagbabago-ng-ruta-ng-dyip",
    title: "Paano naaapektuhan ng pagbabago ng ruta ang araw-araw na biyahe ng mga pasahero ng dyip",
    excerpt: "Mas maaga nang umaalis ng bahay ang ilang pasahero habang inaaral nila ang bagong daan papasok sa trabaho at eskwela.",
    body: [
      "Para sa maraming pasahero, ang dyip pa rin ang pinakaabot-kayang paraan para makarating sa trabaho at paaralan. Kaya kapag nagbago ang ruta, ramdam agad ito sa oras, pamasahe at pasensya ng bawat isa.",
      "Ayon sa ilang nakapanayam na pasahero, ang pinakamalaking hamon ay ang pagsakay nang dalawang beses para sa dating isang biyahe lang. May mga nagsasabing mas maaga na silang umaalis ng bahay para hindi mahuli.",
      "Sinasabi naman ng ilang tsuper na kailangan din nilang mag-adjust: bagong mga terminal, bagong pila, at mga pasaherong hindi pa sanay sa daan. Umaasa sila na magiging malinaw ang mga karatula at abiso sa mga susunod na linggo.",
      "Patuloy na susubaybayan ng Boses ng Bayan ang mga pagbabago sa transportasyon. Kung may karanasan kang gustong ibahagi, maaari mo itong ipadala sa Usap Bayan.",
    ],
    category: "transportasyon",
    image: "ph-jeepney-metro-manila.jpg",
    featured: true,
    location: "ncr",
  },
  {
    slug: "guro-at-magulang-sa-bagong-school-year",
    title: "Mga guro at magulang, nagbahagi ng pananaw sa pagbubukas ng bagong school year",
    excerpt: "Mula sa gamit sa eskwela hanggang sa oras ng biyahe, ito ang mga inaalala ng mga pamilya bago magsimula ang klase.",
    body: [
      "Ilang linggo bago magbukas ang klase, abala na ang mga pamilya sa paghahanda ng uniporme, gamit at baon. Para sa marami, kasabay nito ang pag-iisip kung paano pagkakasyahin ang badyet.",
      "Sinabi ng ilang guro na ang unang mga linggo ay para sa muling pagkakakilala sa mga mag-aaral at pagtingin kung saan sila nangangailangan ng dagdag na tulong, lalo na sa pagbasa at matematika.",
      "Hiling naman ng mga magulang ang mas malinaw na komunikasyon mula sa paaralan: iskedyul, mga kailangang dalhin, at kung paano sila makakatulong sa pag-aaral ng anak sa bahay.",
    ],
    category: "edukasyon",
    image: "ph-classroom-chairs.jpg",
    pick: true,
  },
  {
    slug: "klinika-sa-barangay",
    title: "Klinika sa barangay: ano ang kailangan ng komunidad?",
    excerpt: "Para sa maraming pamilya, ang health center sa barangay ang unang takbuhan. Ano ang makakatulong para mas mapagsilbihan sila?",
    body: [
      "Sa maraming lugar, ang barangay health center ang unang nilalapitan para sa check-up, bakuna at payo tungkol sa kalusugan. Mas malapit ito at mas abot-kaya kaysa sa malalaking ospital.",
      "Ayon sa mga residenteng nakausap, mahalaga ang mas mahabang oras ng serbisyo para sa mga nagtatrabaho, at ang sapat na gamot para sa mga karaniwang sakit.",
      "Sinabi naman ng ilang health worker na malaking tulong ang maayos na listahan ng mga pasyente at ang pakikipagtulungan ng mga volunteer sa pag-abiso tungkol sa mga iskedyul.",
    ],
    category: "kalusugan",
    image: "healthcare.jpg",
    location: "western-visayas",
  },
  {
    slug: "presyo-ng-bilihin-sa-palengke",
    title: "Sa palengke, presyo ng bilihin ang laging usapan",
    excerpt: "Paano nagbabadyet ang mga mamimili at paano umaangkop ang mga tindera kapag gumagalaw ang presyo?",
    body: [
      "Tuwing umaga, isa sa mga unang tanong sa palengke ay kung magkano na ang gulay, isda at bigas. Para sa mga pamilyang may mahigpit na badyet, bawat piso ay binibilang.",
      "Ayon sa ilang tindera, nakadepende ang presyo sa dami ng dumarating na produkto at sa gastos ng pagbiyahe nito mula sa probinsya. Kapag mahirap ang biyahe, ramdam ito sa paninda.",
      "Ang ilang mamimili naman ay namimili na nang mas maaga o mas madalas pero kaunti lang, para makahanap ng mas sariwa at mas murang mabibili.",
    ],
    category: "ekonomiya",
    image: "ph-produce-market.jpg",
    pick: true,
  },
  {
    slug: "manggagawa-at-mahabang-biyahe",
    title: "Mga manggagawa sa lungsod, naghahanap ng mas maikling biyahe",
    excerpt: "Oras sa kalsada ang isa sa pinakamalaking gastos ng mga manggagawa. Ilan sa kanila ang nagbago ng iskedyul at ruta.",
    body: [
      "Para sa maraming manggagawa sa lungsod, ang biyahe papasok at pauwi ay maaaring umabot nang ilang oras bawat araw. Oras itong nawawala sa pamilya at pahinga.",
      "Ilan sa mga nakapanayam ang lumipat sa tren para maiwasan ang trapiko sa kalsada, habang ang iba ay humiling sa kanilang employer ng mas maagang pasok o ilang araw ng trabaho mula sa bahay.",
      "Sinasabi ng mga manggagawa na ang pinakamahalaga ay ang maaasahang biyahe: alam mo kung kailan ka aalis at kailan ka darating.",
    ],
    category: "trabaho",
    image: "ph-mrt-edsa.jpg",
  },
  {
    slug: "tag-ani-sa-palayan",
    title: "Tag-ani sa palayan: kuwento ng mga magsasaka",
    excerpt: "Bago pa sumikat ang araw, nasa bukid na ang mga magsasaka. Ito ang kanilang kuwento sa panahon ng anihan.",
    body: [
      "Sa panahon ng anihan, maagang nagsisimula ang araw sa bukid. Magkakasama ang buong pamilya at mga kapitbahay sa paggapas, paggiik at pagpapatuyo ng palay.",
      "Para sa mga magsasaka, ang anihan ay bunga ng ilang buwang pag-aalaga sa tanim at pagbabantay sa panahon. Isang malakas na ulan lang ay maaaring makaapekto sa buong ani.",
      "Pangarap ng marami sa kanila ang mas maayos na presyo ng palay at mas madaling access sa makinarya at pautang, para hindi na kailangang magbenta agad kahit mababa ang presyo.",
    ],
    category: "komunidad",
    image: "rice-field.jpg",
    location: "central-luzon",
  },
  {
    slug: "maagang-umaga-sa-baybayin",
    title: "Sa isang bayang baybayin, maagang nagsisimula ang araw",
    excerpt: "Habang madilim pa, naghahanda na ang mga mangingisda. Isang umaga sa buhay ng isang komunidad sa tabing-dagat.",
    body: [
      "Bago pa magliwanag, gising na ang mga pamilya sa tabing-dagat. Inaayos ang lambat, sinusuri ang bangka, at binabantayan ang lagay ng dagat.",
      "Pagbalik ng mga mangingisda, sama-sama ang komunidad sa paghila ng lambat at pag-aayos ng huli. Ang ilan ay diretsong dinadala sa palengke, ang iba ay para sa sariling hapag.",
      "Para sa mga taga-baybayin, ang dagat ay kabuhayan at tahanan. Kaya mahalaga sa kanila ang malinis na dalampasigan at maingat na pangingisda para sa susunod na henerasyon.",
    ],
    category: "pilipinas",
    image: "ph-beach-fishing.jpg",
    location: "eastern-visayas",
  },
  {
    slug: "pampublikong-konsultasyon",
    title: "Mga mamamayan, nagtipon para sa pampublikong konsultasyon",
    excerpt: "Bakit mahalagang dumalo sa mga konsultasyon, at paano maririnig ang boses ng mga residente sa mga desisyon ng lokal na pamahalaan?",
    body: [
      "Ang pampublikong konsultasyon ay pagkakataon ng mga residente na magtanong at magbigay ng opinyon bago ipatupad ang mga proyekto at patakaran sa kanilang lugar.",
      "Sinabi ng ilang dumalo na mas nauunawaan nila ang mga plano kapag ipinaliwanag ito nang malinaw at sa wikang ginagamit ng komunidad.",
      "Hinihikayat ng mga residente ang mas maagang abiso at mas maraming paraan para makibahagi, gaya ng mga sesyon sa gabi o pagtanggap ng nakasulat na komento.",
    ],
    category: "pulitika",
    image: "crowd-flag.jpg",
    pick: true,
  },
  {
    slug: "kabataang-boluntaryo-sa-barangay",
    title: "Kabataang boluntaryo, tumutulong sa mga programa ng barangay",
    excerpt: "Mula sa paglilinis hanggang sa pagtuturo, ang mga kabataan ang nagbibigay-buhay sa maraming gawain sa komunidad.",
    body: [
      "Sa maraming barangay, kabataan ang madalas na nangunguna sa mga clean-up drive, tree planting at mga aktibidad para sa mga bata.",
      "Ayon sa ilang boluntaryo, mas marami ang sumasali kapag malinaw kung saan at paano makakatulong, at kapag nakikita nila ang resulta ng kanilang ginagawa.",
      "Para sa kanila, ang pagboboluntaryo ay paraan din para makilala ang kapitbahay at matuto ng mga kasanayang magagamit sa paaralan at trabaho.",
    ],
    category: "komunidad",
    image: "hero-community.jpg",
    location: "davao-region",
  },
  {
    slug: "negosyo-sa-sentro-ng-lungsod",
    title: "Mga negosyo sa sentro ng lungsod, naghahanda sa bagong taon ng piskal",
    excerpt: "Pagpaplano ng badyet, pag-hire at pag-aangkop sa gastos: ito ang pinag-uusapan ng maliliit at malalaking negosyo.",
    body: [
      "Habang papalapit ang bagong taon ng piskal, nirerepaso ng mga negosyo ang kanilang badyet at mga plano. Kasama rito ang gastos sa upa, kuryente at sahod.",
      "Para sa maliliit na negosyo, mahalaga ang maayos na daloy ng pera at ang tiwala ng mga suki. Ang ilan ay nagdadagdag ng online na pagbebenta para maabot ang mas maraming mamimili.",
      "Sinasabi ng ilang negosyante na ang kailangan nila ay malinaw at tuloy-tuloy na mga patakaran, para makapagplano sila nang mas matagal.",
    ],
    category: "business",
    image: "ph-metro-manila-night.jpg",
    location: "ncr",
  },
  {
    slug: "ani-at-presyo-ng-bigas",
    title: "Ani at presyo: paano umaabot ang bigas mula bukid hanggang mesa",
    excerpt: "Mula sa pag-aani hanggang sa pagbebenta sa palengke, maraming kamay ang dinaraanan ng bigas bago makarating sa ating hapag.",
    body: [
      "Bago makarating sa hapag, dumaraan ang bigas sa maraming yugto: pag-aani, pagpapatuyo, paggiling, pagbiyahe at pagbebenta. Bawat isa ay may kaakibat na gastos.",
      "Ayon sa ilang magsasaka, ang presyong natatanggap nila para sa palay ay madalas na malayo sa presyong binabayaran ng mamimili sa tindahan.",
      "Ipinapaliwanag ng mga mangangalakal na malaki ang epekto ng gastos sa transportasyon at imbakan. Ang tanong ng marami: paano mapapaikli ang daan mula bukid hanggang mesa?",
    ],
    category: "ekonomiya",
    image: "rice-harvest.jpg",
    pick: true,
  },
  {
    slug: "teknolohiya-sa-silid-aralan",
    title: "Ang papel ng teknolohiya sa silid-aralan ngayon",
    excerpt: "Kompyuter, internet at mga bagong kasanayan: paano ginagamit ng mga paaralan ang teknolohiya sa pagtuturo?",
    body: [
      "Sa maraming paaralan, bahagi na ng pag-aaral ang kompyuter at internet, mula sa pananaliksik hanggang sa paggawa ng mga proyekto.",
      "Ayon sa ilang guro, ang hamon ay hindi lang ang pagkakaroon ng kagamitan kundi ang pagtuturo kung paano ito gamitin nang tama at ligtas.",
      "Para sa mga mag-aaral, ang mga kasanayang natututunan sa computer laboratory ay magagamit nila hanggang kolehiyo at trabaho.",
    ],
    category: "teknolohiya",
    image: "ph-computer-lab.jpg",
  },
  {
    slug: "kabuhayan-sa-dagat",
    title: "Kabuhayan sa dagat: sama-samang paghila ng bangka sa pampang",
    excerpt: "Sa mga komunidad ng mangingisda, bayanihan pa rin ang sandigan sa araw-araw na hanapbuhay.",
    body: [
      "Kapag dumaong ang bangka, hindi lang ang may-ari ang tumutulong. Sama-samang humihila ang mga kapitbahay para maiahon ito nang ligtas sa pampang.",
      "Para sa mga mangingisda, ang bayanihang ito ay bahagi na ng kanilang buhay. Tulungan sa paghahanda bago pumalaot, at tulungan pagbalik.",
      "Umaasa ang mga komunidad sa tabing-dagat na mas mapapansin ang kanilang pangangailangan, gaya ng ligtas na daungan at suporta tuwing masama ang panahon.",
    ],
    category: "trabaho",
    image: "ph-fishermen-boat.jpg",
    location: "northern-mindanao",
  },
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
    const rendered = renderRichText(doc(a.body));
    const { data, error: insertError } = await editor
      .from("articles")
      .insert({
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        body: rendered.doc as never,
        body_html: rendered.html,
        body_text: rendered.text,
        reading_minutes: rendered.readingMinutes,
        author_id: writerId,
        category_id: cats.find((c) => c.slug === a.category)?.id ?? null,
        featured_image_id: media[a.image] ?? null,
        location_id: a.location ? (locs.find((l) => l.slug === a.location)?.id ?? null) : null,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    for (const to of ["pending_review", "approved", "published"] as const) {
      const { error: tError } = await editor.rpc("transition_article", { p_article_id: data.id, p_to: to, p_note: "Paunang nilalaman" });
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

const POLL_NOTE = "Boluntaryong online poll: isang boto bawat browser. Hindi ito siyentipikong survey at hindi kumakatawan sa buong populasyon ng Pilipinas.";

async function seedPolls(editor: Db) {
  const polls = [
    {
      slug: "pinakamahalagang-isyu",
      question: "Ano ang pinakamahalagang isyu sa inyong lugar ngayon?",
      options: ["Transportasyon", "Presyo ng bilihin", "Trabaho", "Kalusugan"],
      featured: true,
    },
    {
      slug: "paraan-ng-pagbiyahe",
      question: "Paano ka kadalasang bumibiyahe papasok sa trabaho o paaralan?",
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
        .insert({ slug: p.slug, question: p.question, results_visibility: "after_vote", methodology_note: POLL_NOTE })
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

const COMMUNITY: { kind: "perspective" | "question" | "discussion"; title: string; body: string; author_name: string; author_location: string; is_featured?: boolean }[] = [
  { kind: "question", title: "Ano ang pinakamahirap sa araw-araw mong biyahe?", body: "Ibahagi kung gaano katagal ang biyahe mo papasok at pauwi, at ano sa tingin mo ang makakatulong para gumaan ito para sa lahat.", author_name: "Ana", author_location: "Quezon City", is_featured: true },
  { kind: "perspective", title: "Sa aming barangay, malaking tulong ang mas mahabang oras ng health center", body: "Ang mga nagtatrabaho hanggang gabi ay nakakapagpakonsulta na rin dahil bukas pa ang health center pagkatapos ng trabaho. Sana ganito rin sa ibang lugar.", author_name: "Rodel", author_location: "Iloilo" },
  { kind: "discussion", title: "Paano natin matutulungan ang mga magsasaka sa panahon ng anihan?", body: "Ano ang nakikita ninyong solusyon sa presyo ng palay at sa gastos ng pagpapatuyo at pagbiyahe nito? Pag-usapan natin.", author_name: "Mila", author_location: "Nueva Ecija" },
  { kind: "perspective", title: "Mas maraming kabataan ang gustong tumulong kung malinaw ang programa", body: "Kapag alam ng kabataan kung saan at paano sila makakatulong, mas marami ang sumasali sa mga gawain ng barangay. Kailangan lang ng malinaw na paanyaya.", author_name: "Jun", author_location: "Davao City" },
];

/** Approved community posts so Usap Bayan areas render with real rows (service client, local only). */
async function seedCommunity(admin: Db) {
  for (const p of COMMUNITY) {
    const { data: existing } = await admin.from("community_posts").select("id").eq("title", p.title).maybeSingle();
    if (existing) continue;
    const now = new Date().toISOString();
    const { error } = await admin.from("community_posts").insert({ ...p, is_featured: p.is_featured ?? false, status: "approved", moderated_at: now, published_at: now });
    if (error) throw error;
  }
  return COMMUNITY.length;
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
  const posts = await seedCommunity(admin);
  await wireHomepage(editor, media, polls[0]!);
  process.stdout.write(
    [
      "Preview content ready (local only).",
      `  ${articles.length} articles, ${polls.length} polls (0 votes), ${posts} community posts, ${Object.keys(media).length} media assets.`,
      `  Local staff password: ${DEMO_PASSWORD}`,
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
