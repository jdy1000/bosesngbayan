import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { asRole, createStaff, createSupabaseLikeDb, migrationFiles } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let editor: string, writer: string, writer2: string;

async function insertMedia(owner: string, name: string): Promise<string> {
  return asRole(db, "authenticated", owner, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "insert into public.media_assets (kind, storage_path, file_name, mime_type, uploaded_by) values ('image', $1, $2, 'image/png', $3) returning id",
      [`${owner}/${crypto.randomUUID()}-${name}`, name, owner],
    );
    return r.rows[0]!.id;
  });
}

const usages = (user: string, mediaId: string) =>
  asRole(db, "authenticated", user, async (tx) =>
    (await tx.query<{ usage_kind: string; label: string | null; detail: string }>("select * from public.media_usages($1)", [mediaId])).rows,
  );

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  editor = await createStaff(db, "editor@test.local", "editor");
  writer = await createStaff(db, "writer@test.local", "writer");
  writer2 = await createStaff(db, "writer2@test.local", "writer");
});

afterAll(async () => {
  await db.close();
});

describe("media usage and delete protection", () => {
  it("unused media can be deleted by its owner", async () => {
    const id = await insertMedia(writer, "unused.png");
    expect(await usages(writer, id)).toEqual([]);
    await asRole(db, "authenticated", writer, (tx) => tx.query("delete from public.media_assets where id = $1", [id]));
    const left = await db.query("select 1 from public.media_assets where id = $1", [id]);
    expect(left.rows).toHaveLength(0);
  });

  it("reports usage in articles the caller cannot read, with the title redacted, and blocks delete", async () => {
    const id = await insertMedia(writer, "used.png");
    await asRole(db, "authenticated", writer2, (tx) =>
      tx.query("insert into public.articles (slug, title, author_id, featured_image_id) values ('lihim-na-draft', 'Lihim na draft', $1, $2)", [writer2, id]),
    );
    const rows = await usages(writer, id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ usage_kind: "article", label: null, detail: "featured image" });
    expect((await usages(editor, id))[0]!.label).toBe("Lihim na draft");
    await expect(asRole(db, "authenticated", writer, (tx) => tx.query("delete from public.media_assets where id = $1", [id]))).rejects.toThrow(
      /media_in_use/,
    );
  });

  it("finds ids inside homepage section and site settings JSON", async () => {
    const id = await insertMedia(editor, "hero.png");
    await asRole(db, "authenticated", editor, async (tx) => {
      const cfg = await tx.query<{ id: string }>("select id from public.homepage_configurations where status = 'draft'");
      await tx.query(
        "insert into public.homepage_sections (configuration_id, block_type, position, settings) values ($1, 'photo_of_day', 99, jsonb_build_object('media_id', $2::text))",
        [cfg.rows[0]!.id, id],
      );
    });
    await db.query(
      "insert into public.site_settings (key, value) values ('seo', jsonb_build_object('default_og_image_id', $1::text)) on conflict (key) do update set value = public.site_settings.value || excluded.value",
      [id],
    );
    const kinds = (await usages(editor, id)).map((r) => r.usage_kind).sort();
    expect(kinds).toEqual(["homepage_section", "site_setting"]);
    await expect(asRole(db, "authenticated", editor, (tx) => tx.query("delete from public.media_assets where id = $1", [id]))).rejects.toThrow(
      /media_in_use/,
    );
  });

  it("is not callable by anon", async () => {
    const id = await insertMedia(editor, "anon.png");
    await expect(asRole(db, "anon", null, (tx) => tx.query("select * from public.media_usages($1)", [id]))).rejects.toThrow(/permission denied/);
  });
});

describe("homepage draft-only editing", () => {
  it("editors can edit draft sections but not published ones; writers cannot edit at all", async () => {
    const pub = await db.query<{ id: string }>("select s.id from public.homepage_sections s join public.homepage_configurations c on c.id = s.configuration_id where c.status = 'published' limit 1");
    const draft = await db.query<{ id: string }>("select s.id from public.homepage_sections s join public.homepage_configurations c on c.id = s.configuration_id where c.status = 'draft' limit 1");
    const upd = (user: string, sectionId: string) =>
      asRole(db, "authenticated", user, async (tx) => (await tx.query("update public.homepage_sections set title = 'X' where id = $1 returning id", [sectionId])).rows.length);
    expect(await upd(editor, draft.rows[0]!.id)).toBe(1);
    expect(await upd(editor, pub.rows[0]!.id)).toBe(0);
    expect(await upd(writer, draft.rows[0]!.id)).toBe(0);
  });

  it("publish copies the draft and restore brings an archived version back", async () => {
    const before = await db.query<{ id: string }>("select id from public.homepage_configurations where status = 'published'");
    await asRole(db, "authenticated", editor, (tx) => tx.query("select public.publish_homepage('test')"));
    const archived = await db.query<{ status: string }>("select status from public.homepage_configurations where id = $1", [before.rows[0]!.id]);
    expect(archived.rows[0]!.status).toBe("archived");
    await asRole(db, "authenticated", editor, (tx) => tx.query("select public.restore_homepage_to_draft($1)", [before.rows[0]!.id]));
    const counts = await db.query<{ a: number; d: number }>(
      `select (select count(*)::int from public.homepage_sections where configuration_id = $1) as a,
              (select count(*)::int from public.homepage_sections s join public.homepage_configurations c on c.id = s.configuration_id where c.status = 'draft') as d`,
      [before.rows[0]!.id],
    );
    expect(counts.rows[0]!.d).toBe(counts.rows[0]!.a);
    await expect(asRole(db, "authenticated", writer, (tx) => tx.query("select public.publish_homepage(null)"))).rejects.toThrow(/not_authorized/);
  });
});

describe("homepage mission band (20261113000400)", () => {
  const BAND = "custom_cta";
  const runMigration = async () =>
    db.exec(readFileSync(migrationFiles().find((f) => f.endsWith("20261113000400_homepage_mission_band.sql"))!, "utf8"));
  const layout = async (status: "draft" | "published") =>
    (
      await db.query<{ block_type: string; position: number; settings: unknown; title: string | null }>(
        `select s.block_type, s.position, s.settings, s.title from public.homepage_sections s
         join public.homepage_configurations c on c.id = s.configuration_id where c.status = $1 order by s.position`,
        [status],
      )
    ).rows;

  it("sits right after the top stories in the draft and published homepage, with valid settings", async () => {
    const { parseSection } = await import("@/lib/homepage/blocks");
    for (const status of ["draft", "published"] as const) {
      const rows = await layout(status);
      const types = rows.map((r) => r.block_type);
      expect(types.indexOf(BAND), status).toBe(types.indexOf("top_stories") + 1);
      const band = rows.find((r) => r.block_type === BAND)!;
      const { block, issues } = parseSection({ id: "b", block_type: BAND, title: band.title, description: null, settings: band.settings });
      expect(issues).toEqual([]);
      expect(block?.settings).toMatchObject({ cta: { href: "/mag-ulat" }, secondary_cta: { href: "/tungkol" } });
    }
  });

  it("is idempotent and re-inserts after top_stories when missing, shifting later sections", async () => {
    const before = await layout("published");
    await runMigration();
    expect((await layout("published")).map((r) => r.block_type)).toEqual(before.map((r) => r.block_type));
    await db.query(
      `delete from public.homepage_sections where block_type = $1 and configuration_id = (select id from public.homepage_configurations where status = 'published')`,
      [BAND],
    );
    await runMigration();
    const after = await layout("published");
    expect(after.map((r) => r.block_type)).toEqual(before.map((r) => r.block_type));
    expect(new Set(after.map((r) => r.position)).size).toBe(after.length);
  });
});
