import { defineConfig, devices } from "@playwright/test";

// E2E against the built Tykuru desktop app.
//
// The desktop app is launched as a subprocess (the Tauri executable) by the
// specs in tests/e2e. Without a WebView2-capable CI runner and a built binary,
// those tests are skipped. Build the app first with `pnpm build:windows`
// (Windows) then run `pnpm test:e2e`.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // The Tauri app is a native window, not a URL. The test launches it via the
  // `launch` fixture (see tests/e2e/helpers.ts) and drives the WebView through
  // Tauri's exposed `window.__TAURI__` IPC surface. We do not use a baseURL.
});
