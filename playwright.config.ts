import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "artifacts/playwright-report" }]]
    : "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run preview --workspace=@clavis/frontend -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
