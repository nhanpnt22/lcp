import { defineConfig, devices } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const browserTestPort = 43173;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${browserTestPort}`,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `python3 -m http.server ${browserTestPort} --bind 127.0.0.1`,
    cwd: rootDir,
    port: browserTestPort,
    reuseExistingServer: false
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
