import { defineConfig } from "@playwright/test";

// E2E against the built Tykuru desktop app.
//
// Specs in tests/e2e launch the built Tauri executable and attach to its
// WebView2 over the Chrome DevTools Protocol (see tests/e2e/tauri.ts). They
// skip when no built executable is present. Build first with `pnpm build:windows`
// (Windows), then run `pnpm test:e2e`.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    actionTimeout: 15_000,
  },
});
