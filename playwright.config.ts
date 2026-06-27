import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 7_500
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "msedge" }
    }
  ],
  webServer: undefined
});
