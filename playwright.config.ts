import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a local stack seeded with `pnpm db:reset && pnpm seed:demo` and `pnpm dev`
 * (or set E2E_BASE_URL). Demo staff credentials: E2E_EDITOR_EMAIL / DEMO_PASSWORD.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
});
