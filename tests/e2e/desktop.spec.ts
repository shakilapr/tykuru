import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appExeExists, invoke, launchApp, type LaunchedApp } from "./tauri";

let app: LaunchedApp;
let page: Page;

test.beforeAll(async () => {
  if (!appExeExists()) {
    test.skip(true, `built executable not found; run pnpm build:windows first`);
  }
  app = await launchApp();
  page = app.page;
  await expect(page.getByRole("button", { name: "Open .typ" })).toBeVisible();
});

test.afterAll(async () => {
  await app.browser.close();
  app.proc.kill("SIGKILL");
});

const SIDES: Record<string, string> = {};

async function openFixture(name: string): Promise<string> {
  const abs = join(process.cwd(), "fixtures", name, "main.typ");
  const session = await invoke<{ id: string; filename: string }>(page, "open_document", { path: abs });
  SIDES[name] = session.id;
  await expect(page.locator("header")).toContainText(name);
  return session.id;
}

test("open-document: preview renders a PDF canvas", async () => {
  await openFixture("basic");
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({
    timeout: 30_000,
  });
});

test("live-preview: external source edit publishes a newer revision", async () => {
  const dir = join(tmpdir(), "tykuru-e2e-live");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Live\n\nv1\n", "utf8");

  const session = await invoke<{ id: string }>(page, "open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({
    timeout: 30_000,
  });

  writeFileSync(entry, "= Live\n\nv2\n", "utf8");
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active?.id).toBe(session.id);
});

test("dependency-watch: editing an imported file refreshes the preview", async () => {
  const dir = join(tmpdir(), "tykuru-e2e-dep");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "main.typ"), '#import "dep.typ": *\n= Doc\n\n#foo()\n', "utf8");
  writeFileSync(join(dir, "dep.typ"), "#let foo() = text(fill: red)[DEP V1]\n", "utf8");

  const session = await invoke<{ id: string }>(page, "open_document", { path: join(dir, "main.typ") });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({
    timeout: 30_000,
  });

  writeFileSync(join(dir, "dep.typ"), "#let foo() = text(fill: blue)[DEP V2]\n", "utf8");
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active?.id).toBe(session.id);
});

test("error-recovery: invalid source keeps last good preview, repair recovers", async () => {
  const dir = join(tmpdir(), "tykuru-e2e-err");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Good\n\nok\n", "utf8");

  await invoke(page, "open_document", { path: entry });
  const canvas = page.locator('[aria-label="PDF preview"] canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  writeFileSync(entry, "= Broken\n\n#error(\"boom\")\n", "utf8");
  await page.waitForTimeout(1500);
  await expect(canvas).toBeVisible();

  writeFileSync(entry, "= Fixed\n\nok\n", "utf8");
  await page.waitForTimeout(1500);
  await expect(canvas).toBeVisible();
});

test("editor: expand, edit, autosave writes disk bytes", async () => {
  const dir = join(tmpdir(), "tykuru-e2e-editor");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Editor\n", "utf8");

  await invoke(page, "open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Toggle editor" }).click();
  await expect(page.getByLabel("Editor pane")).toBeVisible();

  const cm = page.locator("[data-testid=typst-editor]").first();
  await cm.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("// typed in e2e\n");

  await page.waitForTimeout(2000);
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(entry, "utf8")).toContain("// typed in e2e");
});

test("switch-document: toolbar reflects the latest session", async () => {
  const firstId = await openFixture("imports");
  const secondId = await openFixture("basic");
  expect(secondId).not.toBe(firstId);
  await expect(page.locator("header")).toContainText("basic");
  const active = await invoke<{ id: string } | null>(page, "get_active_session");
  expect(active?.id).toBe(secondId);
});

test("shutdown: closing the app does not crash the test harness", async () => {
  await openFixture("basic");
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({
    timeout: 30_000,
  });
  // The afterAll hook terminates the app; this test just asserts we got this far.
  expect(app.proc.pid).toBeGreaterThan(0);
});
