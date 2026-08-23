import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appExeExists, invoke, launchApp, LaunchUnavailableError, type LaunchedApp } from "./tauri";

let app: LaunchedApp | undefined;
let page: Page;

test.beforeAll(async () => {
  if (!appExeExists()) {
    test.skip(true, `built executable not found; run pnpm build:windows first`);
  }
  try {
    app = await launchApp();
  } catch (e) {
    if (e instanceof LaunchUnavailableError) {
      test.skip(true, e.message);
    }
    throw e;
  }
  page = app.page;
  await expect(page.getByRole("button", { name: "Open .typ" })).toBeVisible();
});

test.afterAll(async () => {
  if (app) {
    await app.browser.close();
    app.proc.kill("SIGKILL");
  }
});

function tempProject(name: string): string {
  const dir = join(tmpdir(), `tykuru-stress-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("stress: 100 rapid source-save cycles stay responsive", async () => {
  const dir = tempProject("saves");
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Stress\n", "utf8");
  await invoke(page, "open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  for (let i = 0; i < 100; i++) {
    writeFileSync(entry, `= Stress\n\nline ${i}\n`, "utf8");
    if (i % 25 === 0) await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active).toBeTruthy();
  expect(readFileSync(entry, "utf8")).toContain("line 99");
});

test("stress: 100 document switch cycles do not crash", async () => {
  const dir = tempProject("switch");
  const a = join(dir, "a.typ");
  const b = join(dir, "b.typ");
  writeFileSync(a, "= A\n", "utf8");
  writeFileSync(b, "= B\n", "utf8");

  await invoke(page, "open_document", { path: a });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  for (let i = 0; i < 100; i++) {
    const next = i % 2 === 0 ? a : b;
    await invoke(page, "open_document", { path: next });
    if (i % 20 === 0) await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active).toBeTruthy();
});

test("stress: delete source while open keeps the app responsive", async () => {
  const dir = tempProject("delete-source");
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Delete me\n", "utf8");
  await invoke(page, "open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  rmSync(entry);
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active).toBeTruthy();
});

test("stress: rename/move source while open does not crash", async () => {
  const dir = tempProject("rename-source");
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Rename me\n", "utf8");
  await invoke(page, "open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  renameSync(entry, join(dir, "moved.typ"));
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active).toBeTruthy();
});

test("stress: long diagnostics do not stall the app", async () => {
  const dir = tempProject("long-diag");
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Long diag\n\n#let x = \"" + "z".repeat(200_000) + "\"\n#error(x)\n", "utf8");
  await invoke(page, "open_document", { path: entry });
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active).toBeTruthy();
});
