import { test, expect } from "@playwright/test";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

const EXE = process.env.TYKURU_EXE ?? "src-tauri/target/release/tykuru.exe";

let proc: ChildProcess | null = null;

test.beforeAll(() => {
  if (!process.env.TYKURU_EXE && !existsSync(EXE)) {
    test.skip(true, `built executable not found at ${EXE}; run pnpm build:windows first`);
  }
});

test.afterAll(() => {
  proc?.kill("SIGTERM");
});

test("opens a .typ and renders a preview", async ({ page }) => {
  proc = spawn(EXE, { stdio: "ignore" });
  // The Tauri WebView exposes window.__TAURI_INTERNALS__; the app boots to the
  // Start screen with an "Open .typ" button.
  await page.goto("tauri://localhost");
  await expect(page.getByRole("button", { name: "Open .typ" })).toBeVisible();

  // Drive open through the IPC: a real E2E would pick a file via the dialog.
  // Here we invoke the backend command directly through the test bridge.
  const session = await page.evaluate(async () => {
    const bridge = (window as unknown as {
      __TYKURU_TEST__?: { openPath: (p: string) => Promise<unknown> };
    });
    return bridge.__TYKURU_TEST__?.openPath("fixtures/basic/main.typ");
  });
  expect(session).toBeTruthy();

  // The preview pane should eventually show rendered content (canvas pages).
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({
    timeout: 30_000,
  });
});

test("start screen is reachable", async ({ page }) => {
  await page.goto("tauri://localhost");
  await expect(page.getByRole("button", { name: "Open .typ" })).toBeVisible();
});
