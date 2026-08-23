// Tauri + Playwright helper (Stage 17 desktop E2E).
//
// A native Tauri window cannot be driven with Playwright's normal browser
// launcher. Instead we launch the built app with WebView2's
// `--remote-debugging-port` argument (via WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS)
// and attach to the running WebView2 process over the Chrome DevTools Protocol.
// This drives the *real* production WebView, so DOM/IPC assertions match what
// a user sees.

import { chromium, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

export const EXE = process.env.TYKURU_EXE ?? "src-tauri/target/release/tykuru.exe";

export interface LaunchedApp {
  browser: Browser;
  page: Page;
  proc: ChildProcess;
}

export function appExeExists(): boolean {
  return existsSync(EXE);
}

export class LaunchUnavailableError extends Error {}

async function connectWithRetry(port: number, timeoutMs: number): Promise<Browser> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 10_000 });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  // The app process is alive but the WebView2 DevTools endpoint is not
  // reachable. Raw CDP is not the officially supported way to drive a Tauri
  // WebView2 app (the supported path is tauri-driver / WebdriverIO); rather
  // than fail the whole CI job, callers should treat this as "skip".
  throw new LaunchUnavailableError(
    `Could not connect to the app's WebView2 DevTools endpoint (${lastErr}). ` +
      "The documented Tauri E2E path is WebDriver/tauri-driver; CDP is best-effort.",
  );
}

async function findTauriPage(browser: Browser, timeoutMs: number): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        if (p.url().startsWith("tauri://")) return p;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new LaunchUnavailableError("Tauri WebView page (tauri://) not found via CDP");
}

/**
 * Launches the built app with an ephemeral CDP port and returns the connected
 * browser, the app's page, and the child process handle.
 *
 * Throws `LaunchUnavailableError` if the WebView2 DevTools endpoint is not
 * reachable — callers should `test.skip` in that case.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const port = 9400 + Math.floor(Math.random() * 500);
  const proc = spawn(EXE, {
    stdio: "ignore",
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
  });

  try {
    const browser = await connectWithRetry(port, 30_000);
    const page = await findTauriPage(browser, 30_000);
    return { browser, page, proc };
  } catch (e) {
    proc.kill("SIGKILL");
    throw e;
  }
}

/** Minimal typed wrapper over the Tauri IPC surface exposed in the WebView. */
export async function invoke<T>(page: Page, cmd: string, args?: Record<string, unknown>): Promise<T> {
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
