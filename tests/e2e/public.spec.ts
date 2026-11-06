import { expect, test } from "@playwright/test";

test("homepage renders CMS hero, navigation and no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("unknown path returns the 404 page", async ({ page }) => {
  const res = await page.goto("/wala-ito-" + Date.now());
  expect(res?.status()).toBe(404);
});

test("admin requires sign-in", async ({ page }) => {
  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a reader can vote once on the featured poll", async ({ page }) => {
  await page.goto("/botohan/pinakamahalagang-isyu");
  const first = page.getByRole("radio").first();
  test.skip((await first.count()) === 0, "Preview poll not seeded (run pnpm seed:demo).");
  await first.check();
  await page.getByRole("button", { name: /bumoto/i }).click();
  await expect(page.getByText(/salamat/i).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /bumoto/i })).toHaveCount(0);
});

test("public API never returns drafts", async ({ request }) => {
  const res = await request.get("/api/public/v1/articles?pageSize=48");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { items: { status?: string }[] } };
  for (const a of body.data.items) expect(a.status ?? "published").toMatch(/published|scheduled/);
});
