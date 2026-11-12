import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let owner: string, admin: string, editor: string, writer: string, moderator: string, analyst: string;
const h = (c: string) => c.repeat(64).slice(0, 64);

async function makePoll(opts: { kind?: "single" | "multiple"; max?: number; visibility?: string; policy?: string; status?: string } = {}) {
  return asRole(db, "authenticated", editor, async (tx) => {
    const slug = `poll-${Math.random().toString(36).slice(2, 10)}`;
    const p = await tx.query<{ id: string }>(
      `insert into public.polls (slug, question, kind, max_choices, results_visibility, voting_policy, status)
       values ($1, 'Ano ang dapat unahin ng komunidad?', $2::public.poll_kind, $3, $4::public.poll_results_visibility, $5::public.poll_voting_policy, 'draft') returning id`,
      [slug, opts.kind ?? "single", opts.max ?? 1, opts.visibility ?? "after_vote", opts.policy ?? "one_per_browser"],
    );
    const pollId = p.rows[0]!.id;
    const o = await tx.query<{ id: string }>(
      "insert into public.poll_options (poll_id, label, position) values ($1, 'Transportasyon', 1), ($1, 'Pabahay', 2), ($1, 'Trabaho', 3) returning id",
      [pollId],
    );
    await tx.query("update public.polls set status = $2::public.poll_status where id = $1", [pollId, opts.status ?? "published"]);
    return { pollId, options: o.rows.map((r) => r.id) };
  });
}

const vote = (pollId: string, options: string[], voter: string, net: string | null = null) =>
  asRole(db, "service_role", null, async (tx) =>
    (await tx.query<{ r: { status: string } }>("select public.cast_vote($1, $2::uuid[], $3, $4) as r", [pollId, options, voter, net])).rows[0]!.r.status,
  );

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@test.local", "owner");
  admin = await createStaff(db, "admin@test.local", "administrator");
  editor = await createStaff(db, "editor@test.local", "editor");
  writer = await createStaff(db, "writer@test.local", "writer");
  moderator = await createStaff(db, "mod@test.local", "moderator");
  analyst = await createStaff(db, "analyst@test.local", "analyst");
});

afterAll(async () => {
  await db.close();
});

describe("polls and vote integrity", () => {
  it("anon and staff cannot call cast_vote directly", async () => {
    const { pollId, options } = await makePoll();
    await expect(
      asRole(db, "anon", null, (tx) => tx.query("select public.cast_vote($1, $2::uuid[], $3, null)", [pollId, [options[0]], h("a")])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, "authenticated", owner, (tx) => tx.query("select public.cast_vote($1, $2::uuid[], $3, null)", [pollId, [options[0]], h("a")])),
    ).rejects.toThrow(/permission denied/);
  });

  it("accepts one vote per voter and rejects duplicates", async () => {
    const { pollId, options } = await makePoll();
    expect(await vote(pollId, [options[0]!], h("1"))).toBe("ok");
    expect(await vote(pollId, [options[1]!], h("1"))).toBe("already_voted");
    expect(await vote(pollId, [options[1]!], h("2"))).toBe("ok");
  });

  it("network policy blocks a second ballot from the same network", async () => {
    const { pollId, options } = await makePoll({ policy: "one_per_browser_and_network" });
    expect(await vote(pollId, [options[0]!], h("3"), h("n"))).toBe("ok");
    expect(await vote(pollId, [options[0]!], h("4"), h("n"))).toBe("already_voted");
  });

  it("validates option membership and choice counts", async () => {
    const single = await makePoll();
    const other = await makePoll();
    expect(await vote(single.pollId, [other.options[0]!], h("5"))).toBe("invalid");
    expect(await vote(single.pollId, [single.options[0]!, single.options[1]!], h("5"))).toBe("invalid");
    const multi = await makePoll({ kind: "multiple", max: 2 });
    expect(await vote(multi.pollId, [multi.options[0]!, multi.options[1]!, multi.options[2]!], h("6"))).toBe("invalid");
    expect(await vote(multi.pollId, [multi.options[0]!, multi.options[1]!], h("6"))).toBe("ok");
  });

  it("refuses votes on draft or closed polls", async () => {
    const draft = await makePoll({ status: "draft" });
    expect(await vote(draft.pollId, [draft.options[0]!], h("7"))).toBe("invalid");
    const closed = await makePoll({ status: "closed" });
    expect(await vote(closed.pollId, [closed.options[0]!], h("7"))).toBe("closed");
  });

  it("freezes question and options once votes exist", async () => {
    const { pollId, options } = await makePoll();
    await vote(pollId, [options[0]!], h("8"));
    await expect(
      asRole(db, "authenticated", editor, (tx) => tx.query("update public.poll_options set label = 'Iba' where id = $1", [options[0]])),
    ).rejects.toThrow(/poll_options_locked_after_votes/);
    await expect(
      asRole(db, "authenticated", editor, (tx) => tx.query("delete from public.poll_options where id = $1", [options[1]])),
    ).rejects.toThrow(/poll_options_locked_after_votes/);
    await expect(
      asRole(db, "authenticated", editor, (tx) => tx.query("update public.polls set question = 'Bagong tanong?' where id = $1", [pollId])),
    ).rejects.toThrow(/poll_locked_after_votes/);
    // Reordering and closing stay allowed.
    await asRole(db, "authenticated", editor, (tx) => tx.query("update public.poll_options set position = 9 where id = $1", [options[0]]));
    await asRole(db, "authenticated", editor, (tx) => tx.query("update public.polls set status = 'closed' where id = $1", [pollId]));
  });

  it("results follow the visibility rule", async () => {
    const { pollId, options } = await makePoll({ visibility: "after_vote" });
    await vote(pollId, [options[2]!], h("9"));
    const results = (voter: string | null) =>
      asRole(db, "service_role", null, async (tx) =>
        (await tx.query<{ r: { visible: boolean; total_ballots?: number } }>("select public.get_poll_results($1, $2) as r", [pollId, voter])).rows[0]!.r,
      );
    expect((await results(h("x"))).visible).toBe(false);
    const mine = await results(h("9"));
    expect(mine.visible).toBe(true);
    expect(mine.total_ballots).toBe(1);
    const staff = await asRole(db, "authenticated", analyst, async (tx) =>
      (await tx.query<{ r: { visible: boolean } }>("select public.get_poll_results($1, null) as r", [pollId])).rows[0]!.r,
    );
    expect(staff.visible).toBe(true);
  });

  it("ballots are not readable by anon or staff tables", async () => {
    const r = await asRole(db, "anon", null, (tx) => tx.query("select * from public.poll_ballots"));
    expect(r.rows).toHaveLength(0);
    const s = await asRole(db, "authenticated", owner, (tx) => tx.query("select * from public.poll_ballots"));
    expect(s.rows).toHaveLength(0);
  });

  it("writers cannot create polls; only one poll can be featured", async () => {
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("insert into public.polls (slug, question) values ('w-poll', 'Tanong ng writer?')")),
    ).rejects.toThrow(/row-level security/);
    const a = await makePoll();
    const b = await makePoll();
    await asRole(db, "authenticated", editor, (tx) => tx.query("update public.polls set is_featured = true where id = $1", [a.pollId]));
    await expect(
      asRole(db, "authenticated", editor, (tx) => tx.query("update public.polls set is_featured = true where id = $1", [b.pollId])),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("newsletter", () => {
  const sub = (email: string) =>
    asRole(db, "service_role", null, async (tx) =>
      (await tx.query<{ s: string }>("select public.subscribe_newsletter($1, 'consent text here', 'test') as s", [email])).rows[0]!.s,
    );

  it("subscribes, deduplicates case-insensitively, and unsubscribes by token", async () => {
    expect(await sub("Juan@Example.com")).toBe("subscribed");
    expect(await sub("juan@example.com")).toBe("already_subscribed");
    const token = (await db.query<{ t: string }>("select unsubscribe_token t from public.newsletter_subscribers where email = 'juan@example.com'")).rows[0]!.t;
    await asRole(db, "service_role", null, (tx) => tx.query("select public.unsubscribe_newsletter($1)", [token]));
    expect(await sub("juan@example.com")).toBe("resubscribed");
  });

  it("subscribers are private: anon and analysts cannot list them; admins can", async () => {
    const anon = await asRole(db, "anon", null, (tx) => tx.query("select email from public.newsletter_subscribers"));
    expect(anon.rows).toHaveLength(0);
    const an = await asRole(db, "authenticated", analyst, (tx) => tx.query("select email from public.newsletter_subscribers"));
    expect(an.rows).toHaveLength(0);
    const ad = await asRole(db, "authenticated", admin, (tx) => tx.query("select email from public.newsletter_subscribers"));
    expect(ad.rows.length).toBeGreaterThan(0);
  });

  it("anon cannot call subscribe directly", async () => {
    await expect(asRole(db, "anon", null, (tx) => tx.query("select public.subscribe_newsletter('x@y.ph', 'c', 's')"))).rejects.toThrow(/permission denied/);
  });
});

describe("community moderation", () => {
  let postId: string;

  it("submissions start pending and are invisible to the public", async () => {
    const r = await asRole(db, "service_role", null, (tx) =>
      tx.query<{ r: { id: string; status: string } }>(
        "select public.submit_community_post('perspective', 'Kailangan ng mas maraming bus', 'Araw-araw kaming naghihintay ng dalawang oras para sa sasakyan.', 'Maria', 'maria@example.com', 'Cebu', null, $1) as r",
        [h("c")],
      ),
    );
    postId = r.rows[0]!.r.id;
    expect(r.rows[0]!.r.status).toBe("pending");
    const anon = await asRole(db, "anon", null, (tx) => tx.query("select id from public.community_posts where id = $1", [postId]));
    expect(anon.rows).toHaveLength(0);
  });

  it("anon can never read private columns", async () => {
    await expect(asRole(db, "anon", null, (tx) => tx.query("select author_email from public.community_posts"))).rejects.toThrow(/permission denied/);
    await expect(asRole(db, "anon", null, (tx) => tx.query("select network_hash from public.comments"))).rejects.toThrow(/permission denied/);
  });

  it("writers cannot moderate; moderators can, with history", async () => {
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("select public.moderate_content('community_post', $1, 'approve', null)", [postId])),
    ).rejects.toThrow(/not_authorized/);
    await asRole(db, "authenticated", moderator, (tx) => tx.query("select public.moderate_content('community_post', $1, 'approve', 'OK')", [postId]));
    const anon = await asRole(db, "anon", null, (tx) => tx.query("select id, title from public.community_posts where id = $1", [postId]));
    expect(anon.rows).toHaveLength(1);
    const hist = await db.query("select action from public.content_activity_logs where entity_id = $1", [postId]);
    expect(hist.rows).toEqual([{ action: "moderation:approve" }]);
  });

  it("reports are created via service RPC and resolved by moderators", async () => {
    const r = await asRole(db, "service_role", null, (tx) =>
      tx.query<{ id: string }>("select public.submit_report($1, null, 'spam', 'paulit-ulit', $2) as id", [postId, h("r")]),
    );
    const reportId = r.rows[0]!.id;
    const anon = await asRole(db, "anon", null, (tx) => tx.query("select * from public.moderation_reports"));
    expect(anon.rows).toHaveLength(0);
    await asRole(db, "authenticated", moderator, (tx) => tx.query("select public.resolve_report($1, 'dismissed', 'Hindi spam')", [reportId]));
    const row = await db.query<{ status: string; resolved_by: string }>("select status, resolved_by from public.moderation_reports where id = $1", [reportId]);
    expect(row.rows[0]).toMatchObject({ status: "dismissed", resolved_by: moderator });
  });

  describe("report status: reviewing", () => {
    let reportId: string;
    const setStatus = (userId: string, status: string) =>
      asRole(db, "authenticated", userId, (tx) => tx.query("select public.resolve_report($1, $2::public.report_status, 'Tala ng moderator')", [reportId, status]));
    const readReport = async () =>
      (
        await db.query<{ status: string; resolved_by: string | null; resolved_at: Date | null }>(
          "select status, resolved_by, resolved_at from public.moderation_reports where id = $1",
          [reportId],
        )
      ).rows[0]!;

    it("a moderator can mark a report as reviewing without closing it", async () => {
      // Arrange
      const created = await asRole(db, "service_role", null, (tx) =>
        tx.query<{ id: string }>("select public.submit_report($1, null, 'other', 'Pakisuri po ito', $2) as id", [postId, h("s")]),
      );
      reportId = created.rows[0]!.id;

      // Act
      await setStatus(moderator, "reviewing");

      // Assert
      expect(await readReport()).toEqual({ status: "reviewing", resolved_by: null, resolved_at: null });
    });

    it("resolving records who closed it and when", async () => {
      await setStatus(moderator, "resolved");

      const report = await readReport();
      expect(report).toMatchObject({ status: "resolved", resolved_by: moderator });
      expect(report.resolved_at).not.toBeNull();
    });

    it("moving a closed report back to open or reviewing clears who closed it and when", async () => {
      await setStatus(moderator, "open");
      expect(await readReport()).toEqual({ status: "open", resolved_by: null, resolved_at: null });

      await setStatus(moderator, "dismissed");
      expect((await readReport()).resolved_at).not.toBeNull();

      await setStatus(moderator, "reviewing");
      expect(await readReport()).toEqual({ status: "reviewing", resolved_by: null, resolved_at: null });
    });

    it("every status change is written to the activity log", async () => {
      const log = await db.query<{ action: string }>(
        "select action from public.content_activity_logs where entity_type = 'report' and entity_id = $1 order by id",
        [reportId],
      );
      expect(log.rows.map((r) => r.action)).toEqual(["report:reviewing", "report:resolved", "report:open", "report:dismissed", "report:reviewing"]);
    });

    it("a user without moderation.manage still cannot change a report", async () => {
      await expect(setStatus(writer, "reviewing")).rejects.toThrow(/not_authorized/);
      await expect(setStatus(writer, "resolved")).rejects.toThrow(/not_authorized/);
      expect((await readReport()).status).toBe("reviewing");
    });
  });

  it("comments on unpublished articles are refused", async () => {
    const art = await asRole(db, "authenticated", writer, async (tx) =>
      (await tx.query<{ id: string }>("insert into public.articles (slug, title, author_id) values ('comment-target', 'X', $1) returning id", [writer])).rows[0]!.id,
    );
    await expect(
      asRole(db, "service_role", null, (tx) => tx.query("select public.submit_comment($1, null, null, 'Ana', '', 'Hello po', $2)", [art, h("q")])),
    ).rejects.toThrow(/comments_closed/);
  });
});

describe("team management and audit", () => {
  it("administrator cannot grant owner, cannot change own role, but can assign editor", async () => {
    const target = await createStaff(db, "new@test.local", null);
    await expect(asRole(db, "authenticated", admin, (tx) => tx.query("select public.set_user_role($1, 'owner')", [target]))).rejects.toThrow(/owner_role_protected/);
    await expect(asRole(db, "authenticated", admin, (tx) => tx.query("select public.set_user_role($1, 'editor')", [admin]))).rejects.toThrow(/cannot_change_own_role/);
    await asRole(db, "authenticated", admin, (tx) => tx.query("select public.set_user_role($1, 'editor')", [target]));
    const audit = await db.query<{ actor_id: string }>("select actor_id from public.audit_logs where entity_type = 'user_roles' and entity_id = $1", [target]);
    expect(audit.rows.at(-1)!.actor_id).toBe(admin);
  });

  it("administrator cannot deactivate the owner; editors cannot manage users", async () => {
    await expect(asRole(db, "authenticated", admin, (tx) => tx.query("select public.set_user_active($1, false)", [owner]))).rejects.toThrow(/owner_role_protected/);
    await expect(asRole(db, "authenticated", editor, (tx) => tx.query("select public.set_user_active($1, false)", [writer]))).rejects.toThrow(/not_authorized/);
  });

  it("is_active cannot be flipped with a direct update", async () => {
    await expect(
      asRole(db, "authenticated", admin, (tx) => tx.query("update public.profiles set is_active = false where id = $1", [writer])),
    ).rejects.toThrow(/use_set_user_active/);
  });

  it("deactivated staff lose all permissions immediately", async () => {
    const temp = await createStaff(db, "temp@test.local", "editor");
    await asRole(db, "authenticated", admin, (tx) => tx.query("select public.set_user_active($1, false)", [temp]));
    const perms = await asRole(db, "authenticated", temp, (tx) => tx.query("select * from public.my_permissions()"));
    expect(perms.rows).toHaveLength(0);
  });

  it("only the owner can edit the permission matrix, and never owner/roles.manage", async () => {
    await expect(
      asRole(db, "authenticated", admin, (tx) => tx.query("select public.set_role_permission('writer', 'articles.publish', true)")),
    ).rejects.toThrow(/not_authorized/);
    await asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_role_permission('writer', 'articles.publish', true)"));
    await expect(
      asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_role_permission('administrator', 'roles.manage', true)")),
    ).rejects.toThrow(/roles_manage_owner_only/);
    await asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_role_permission('writer', 'articles.publish', false)"));
  });

  it("audit log is readable only with audit.view", async () => {
    const ed = await asRole(db, "authenticated", editor, (tx) => tx.query("select 1 from public.audit_logs"));
    expect(ed.rows).toHaveLength(0);
    const ow = await asRole(db, "authenticated", owner, (tx) => tx.query("select 1 from public.audit_logs"));
    expect(ow.rows.length).toBeGreaterThan(0);
  });
});

describe("homepage builder", () => {
  it("editor publishes the draft; anon sees only the published version; writer cannot", async () => {
    await asRole(db, "authenticated", editor, (tx) =>
      tx.query(
        "update public.homepage_sections set title = 'Bagong Pamagat' where block_type = 'latest_articles' and configuration_id = (select id from public.homepage_configurations where status = 'draft')",
      ),
    );
    const before = await asRole(db, "anon", null, (tx) => tx.query<{ title: string }>("select s.title from public.homepage_sections s where s.block_type = 'latest_articles'"));
    expect(before.rows.map((r) => r.title)).toEqual(["Pinakabagong Balita"]);
    await expect(asRole(db, "authenticated", writer, (tx) => tx.query("select public.publish_homepage('x')"))).rejects.toThrow(/not_authorized/);
    await asRole(db, "authenticated", editor, (tx) => tx.query("select public.publish_homepage('v2')"));
    const after = await asRole(db, "anon", null, (tx) => tx.query<{ title: string }>("select s.title from public.homepage_sections s where s.block_type = 'latest_articles'"));
    expect(after.rows.map((r) => r.title)).toEqual(["Bagong Pamagat"]);
  });

  it("published configurations cannot be edited directly", async () => {
    const r = await asRole(db, "authenticated", editor, (tx) =>
      tx.query(
        "update public.homepage_sections set title = 'x' where configuration_id = (select id from public.homepage_configurations where status = 'published')",
      ),
    );
    expect(r.affectedRows ?? 0).toBe(0);
  });
});

describe("storage policies", () => {
  it("uploads only into the uploader's own folder", async () => {
    await asRole(db, "authenticated", writer, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', $1)", [`${writer}/a.jpg`]));
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', $1)", [`${editor}/b.jpg`])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asRole(db, "authenticated", analyst, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', $1)", [`${analyst}/c.jpg`])),
    ).rejects.toThrow(/row-level security/);
  });

  it("writers cannot delete others' files; editors (media.manage_any) can", async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('media', $1)", [`${editor}/x.jpg`]);
    const w = await asRole(db, "authenticated", writer, (tx) => tx.query("delete from storage.objects where name = $1", [`${editor}/x.jpg`]));
    expect(w.affectedRows ?? 0).toBe(0);
    const e = await asRole(db, "authenticated", editor, (tx) => tx.query("delete from storage.objects where name = $1", [`${writer}/a.jpg`]));
    expect(e.affectedRows).toBe(1);
  });
});
