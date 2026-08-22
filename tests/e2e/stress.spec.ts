import { test, expect, Page } from "@playwright/test";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const EXE = process.env.TYKURU_EXE ?? "src-tauri/target/release/tykuru.exe";

let proc: ChildProcess | null = null;
let page: Page;

test.beforeAll(async ({ browser }) => {
  if (!process.env.TYKURU_EXE && !existsSync(EXE)) {
    test.skip(true, `built executable not found at ${EXE}; run pnpm build:windows first`);
  }
  proc = spawn(EXE, { stdio: "ignore" });
  page = await browser.newPage();
  await page.goto("tauri://localhost");
  await expect(page.getByRole("button", { name: "Open .typ" })).toBeVisible();
});

test.afterAll(async () => {
  await page?.close();
  proc?.kill("SIGTERM");
});

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const payload = JSON.stringify({ cmd, args });
  return page.evaluate((raw) => {
    const { cmd: name, args: a } = JSON.parse(raw) as {
      cmd: string;
      args?: Record<string, unknown>;
    };
    return (window as unknown as { __TAURI_INTERNALS__: { invoke: (n: string, a?: unknown) => Promise<unknown> } })
      .__TAURI_INTERNALS__.invoke(name, a);
  }, payload) as Promise<T>;
}

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
  await invoke("open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  // 100 rapid external writes; the app must stay responsive (no crash/hang).
  for (let i = 0; i < 100; i++) {
    writeFileSync(entry, `= Stress\n\nline ${i}\n`, "utf8");
    if (i % 25 === 0) {
      await page.waitForTimeout(100);
    }
  }
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>("get_active_session");
  expect(active).toBeTruthy();
  expect(readFileSync(entry, "utf8")).toContain("line 99");
});

test("stress: 100 document switch cycles do not crash", async () => {
  const dir = tempProject("switch");
  const a = join(dir, "a.typ");
  const b = join(dir, "b.typ");
  writeFileSync(a, "= A\n", "utf8");
  writeFileSync(b, "= B\n", "utf8");

  await invoke("open_document", { path: a });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  for (let i = 0; i < 100; i++) {
    const next = i % 2 === 0 ? a : b;
    await invoke("open_document", { path: next });
    if (i % 20 === 0) await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  const active = await invoke<{ id: string } | null>("get_active_session");
  expect(active).toBeTruthy();
});

test("stress: delete source while open keeps the app responsive", async () => {
  const dir = tempProject("delete-source");
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Delete me\n", "utf8");
  await invoke("open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  rmSync(entry);
  await page.waitForTimeout(1500);
  // The app must not crash; the preview may still show the last-good revision.
  const active = await invoke<{ id: string } | null>("get_active_session");
  expect(active).toBeTruthy();
});

test("stress: rename/move source while open does not crash", async () => {
  const dir = tempProject("rename-source");
  const entry = join(dir, "main.typ");
  writeFileSync(entry, "= Rename me\n", "utf8");
  await invoke("open_document", { path: entry });
  await expect(page.locator('[aria-label="PDF preview"] canvas').first()).toBeVisible({ timeout: 30_000 });

  const moved = join(dir, "moved.typ");
  renameSync(entry, moved);
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>("get_active_session");
  expect(active).toBeTruthy();
});

test("stress: long diagnostics do not stall the app", async () => {
  const dir = tempProject("long-diag");
  const entry = join(dir, "main.typ");
  // A very long error message (huge line) exercises the bounded diagnostic path.
  writeFileSync(entry, "= Long diag\n\n#let x = \"" + "z".repeat(200_000) + "\"\n#error(x)\n", "utf8");
  await invoke("open_document", { path: entry });
  await page.waitForTimeout(1500);
  const active = await invoke<{ id: string } | null>("get_active_session");
  expect(active).toBeTruthy();
});
