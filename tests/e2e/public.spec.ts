import { expect, test } from "@playwright/test";

test("homepage renders a page title, navigation and no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  // The news layout's h1 is visually hidden (the masthead is the logo); it must still exist once.
  await expect(page.locator("h1")).toHaveCount(1);
  // Below lg the category navigation lives behind the menu button.
  const menu = page.getByRole("button", { name: "Buksan ang menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Pangunahing navigation" })).toBeVisible();
  }
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
  // Readers click the whole option row (a <label>); the radio itself is visually hidden.
  await page.locator("label:has(input[type=radio])").first().click();
  await expect(first).toBeChecked();
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
