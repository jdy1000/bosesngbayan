import { beforeAll, describe, expect, it } from "vitest";

// serverEnv() caches on first use, so secrets must exist before any module calls it.
beforeAll(async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-xxxxxxxxxxxx";
  process.env.HASH_SECRET = "h".repeat(40);
  process.env.CRON_SECRET = "c".repeat(40);
  await import("@/lib/rich-text/render"); // TipTap is slow to load cold; warm it under hookTimeout
});

describe("rich-text sanitizer", () => {
  it("strips scripts, event handlers and javascript: links", async () => {
    const { sanitizeRichHtml } = await import("@/lib/rich-text/render");
    const out = sanitizeRichHtml(
      '<p onclick="x()">hi<script>alert(1)</script></p><a href="javascript:alert(1)">a</a><img src="x" onerror="y()"><iframe src="https://evil.example/x"></iframe>',
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|evil\.example/);
    expect(out).toContain("<p>hi</p>");
  });

  it("forces safe rel/target on links and keeps YouTube embeds", async () => {
    const { sanitizeRichHtml } = await import("@/lib/rich-text/render");
    const out = sanitizeRichHtml(
      '<a href="https://example.com">x</a><iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>',
    );
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("youtube-nocookie.com/embed/abc123");
  });

  it("renders a TipTap doc to escaped HTML with text and reading time", async () => {
    const { renderRichText } = await import("@/lib/rich-text/render");
    const r = renderRichText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a <b>b</b>" }] }] });
    expect(r.html).toBe("<p>a &lt;b&gt;b&lt;/b&gt;</p>");
    expect(r.text).toBe("a <b>b</b>");
    expect(r.readingMinutes).toBe(1);
    expect(() => renderRichText({ type: "nope" })).toThrow();
  });
});

describe("cron auth", () => {
  const req = (auth?: string) => new Request("https://x.test/api/cron/publish", { headers: auth ? { authorization: auth } : {} });

  it("accepts only the exact bearer secret", async () => {
    const { isAuthorizedCron } = await import("@/lib/security/cron");
    expect(isAuthorizedCron(req(`Bearer ${"c".repeat(40)}`))).toBe(true);
    expect(isAuthorizedCron(req(`Bearer ${"c".repeat(39)}d`))).toBe(false);
    expect(isAuthorizedCron(req("Bearer short"))).toBe(false);
    expect(isAuthorizedCron(req())).toBe(false);
  });
});

describe("hashes", () => {
  it("are deterministic, scoped, and never echo the raw value", async () => {
    const { voterHash, networkHash, visitorHash } = await import("@/lib/security/hash");
    expect(voterHash("tok")).toBe(voterHash("tok"));
    expect(voterHash("tok")).toMatch(/^[0-9a-f]{64}$/);
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1", "user-agent": "Mozilla/5.0 test" });
    expect(networkHash(h)).not.toBe(voterHash("203.0.113.5"));
    expect(networkHash(h)).not.toContain("203.0.113.5");
    // visitor hash rotates per Manila day
    expect(visitorHash(h, new Date("2026-11-05T15:00:00Z"))).not.toBe(visitorHash(h, new Date("2026-11-05T17:00:00Z")));
  });

  it("flags bots and empty user agents", async () => {
    const { isLikelyBot } = await import("@/lib/security/hash");
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36")).toBe(false);
  });
});

describe("same-origin check", () => {
  it("requires a matching Origin or Referer", async () => {
    const { isSameOrigin } = await import("@/lib/security/request");
    const mk = (h: Record<string, string>) => new Request("https://site.test/api/public/v1/newsletter", { method: "POST", headers: h });
    expect(isSameOrigin(mk({ origin: "https://site.test" }))).toBe(true);
    expect(isSameOrigin(mk({ origin: "https://evil.test" }))).toBe(false);
    expect(isSameOrigin(mk({ referer: "https://site.test/balita/x" }))).toBe(true);
    expect(isSameOrigin(mk({}))).toBe(false);
  });
});

describe("upload sniffing", () => {
  it("identifies real images by magic bytes and rejects others", async () => {
    const { sniffMime } = await import("@/lib/media");
    const pad = (head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)]);
    expect(sniffMime(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(pad([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(sniffMime(pad([0x4d, 0x5a, 0x90, 0x00]))).toBeNull(); // Windows PE
    expect(sniffMime(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
  });
});

describe("homepage block schemas", () => {
  it("rejects unsafe CTA hrefs", async () => {
    const { safeHref } = await import("@/lib/homepage/blocks");
    for (const ok of ["/", "/botohan", "https://example.com/x"]) expect(safeHref.safeParse(ok).success).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.test", "http://insecure.test", "data:text/html,x"])
      expect(safeHref.safeParse(bad).success).toBe(false);
  });

  it("gives every block type valid defaults and rejects unknown types", async () => {
    const { BLOCK_TYPES, defaultSettings, parseSection } = await import("@/lib/homepage/blocks");
    for (const type of BLOCK_TYPES) {
      if (type === "quote_of_day" || type === "news_quiz") continue; // intentionally blank until an editor writes them
      const { block, issues } = parseSection({ id: "s", block_type: type, title: null, description: null, settings: defaultSettings(type) });
      expect(issues, type).toEqual([]);
      expect(block?.type).toBe(type);
    }
    expect(parseSection({ id: "q", block_type: "quote_of_day", title: null, description: null, settings: defaultSettings("quote_of_day") }).block).toBeNull();
    expect(parseSection({ id: "s", block_type: "marquee", title: null, description: null, settings: {} }).block).toBeNull();
  });

  it("uses English titles and link labels only in English mode, falling back when they are empty", async () => {
    const { parseSection } = await import("@/lib/homepage/blocks");
    const raw = {
      id: "s",
      block_type: "trending_topics",
      title: "Mga Paksa",
      title_en: "Topics",
      description: "Paglalarawan",
      description_en: null,
      settings: { view_all: { label: "Lahat ng paksa", label_en: "All topics", href: "/paksa" } },
    };
    const label = (b: ReturnType<typeof parseSection>["block"]) => (b?.settings as { view_all: { label: string } }).view_all.label;
    const fil = parseSection(raw).block;
    expect([fil?.title, label(fil)]).toEqual(["Mga Paksa", "Lahat ng paksa"]);
    const en = parseSection(raw, "en").block;
    expect([en?.title, en?.description, label(en)]).toEqual(["Topics", "Paglalarawan", "All topics"]);
    const noEn = parseSection({ ...raw, settings: { view_all: { label: "Lahat ng paksa", href: "/paksa" } } }, "en").block;
    expect(label(noEn)).toBe("Lahat ng paksa");
  });

  it("accepts an optional second CTA link with the same href rules and English label", async () => {
    const { parseSection } = await import("@/lib/homepage/blocks");
    const section = (secondary: unknown) => ({
      id: "m",
      block_type: "custom_cta",
      title: null,
      description: null,
      settings: { variant: "feature_tiles", cta: { label: "Mag-ulat", href: "/mag-ulat" }, secondary_cta: secondary },
    });
    const ok = parseSection(section({ label: "Tungkol sa Amin", label_en: "About us", href: "/tungkol" }), "en").block;
    expect((ok?.settings as { secondary_cta: { label: string } }).secondary_cta.label).toBe("About us");
    expect((parseSection({ ...section(null), settings: { variant: "simple" } }).block?.settings as { secondary_cta: unknown }).secondary_cta).toBeNull();
    expect(parseSection(section({ label: "x", href: "javascript:alert(1)" })).block).toBeNull();
  });
});

describe("brand contrast", () => {
  it("matches WCAG ratios for the default palette and rejects pale colours", async () => {
    const { contrastWithWhite } = await import("@/lib/settings/schema");
    expect(contrastWithWhite("#1d4ed8")).toBeCloseTo(6.7, 1);
    expect(contrastWithWhite("#d62828")).toBeGreaterThanOrEqual(4.5);
    expect(contrastWithWhite("#ffcc00")).toBeLessThan(4.5);
  });
});

describe("format helpers", () => {
  it("slugifies Filipino text and converts Manila local time", async () => {
    const { slugify, isValidSlug, manilaLocalToIso, isoToManilaLocal } = await import("@/lib/format");
    expect(slugify("Señor Niño: Balita ng Bayan!")).toBe("senor-nino-balita-ng-bayan");
    expect(isValidSlug("a--b")).toBe(false);
    expect(manilaLocalToIso("2026-11-06T08:00")).toBe("2026-11-06T00:00:00.000Z");
    expect(manilaLocalToIso("bad")).toBeNull();
    expect(isoToManilaLocal("2026-11-06T00:00:00.000Z")).toBe("2026-11-06T08:00");
  });
});
