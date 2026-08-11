import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests, against the real app and the real database.
 *
 * This repo had none, and that was the largest gap in how it was verified:
 * every client-side fix could be checked by reading the source or by driving
 * the HTTP API, and neither of those clicks a button. A cart that cannot be
 * emptied, a Place-order that never enables, a form whose Save is disabled by a
 * rule nobody can satisfy — none of it shows up in a unit test.
 *
 * Specs are `.spec.ts` so vitest, which collects `tests/**\/*.test.ts`, does not
 * try to run them in jsdom.
 *
 * The dev server is REUSED rather than started: it is already running during
 * development, and a second one would fight for the port and the database.
 * `webServer` is still declared so a cold machine can run the suite unattended.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  // These place real orders against one shared database, so they run one at a
  // time — parallel runs would interleave their snapshots and restores.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // A cold Next dev route can take a while to compile on first hit.
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
