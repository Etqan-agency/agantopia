import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // One worker: specs share the running dev server + worker, and the performance spec needs an idle machine.
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../../test-results/playwright-report" }]],
  outputDir: "../../test-results/e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // Desktop specs depend on the >=900px rail; the mobile project runs only the phone-specific checks.
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testMatch: /(09-accessibility-responsive|12-marketing-site)\.spec\.ts/, grep: /mobile 390x844/ },
  ],
});
