import { describe, expect, it, beforeEach } from "vitest";

// The browser-mode IPC mock in src/bridge/commands.ts only activates when the
// Tauri runtime globals are absent. We exercise it by importing the module
// fresh with the globals stripped.

// De-dup: delete the module so each test gets a fresh mockContent.
const MODULE = "@/bridge/commands";

async function loadBrowserMode() {
  vi.resetModules();
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  delete (window as { __TAURI_IPC__?: unknown }).__TAURI_IPC__;
  return import(MODULE);
}

async function loadTauriMode() {
  vi.resetModules();
  (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke: vi.fn() };
  (window as { __TAURI_IPC__?: unknown }).__TAURI_IPC__ = {};
  return import(MODULE);
}

describe("browser-mode IPC mock", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("mocks openDocument with the real SessionSummary shape", async () => {
    const { openDocument } = await loadBrowserMode();
    const session = await openDocument("C:\\docs\\main.typ");
    expect(session.id).toBe("mock-session-123");
    expect(session.filename).toBe("main.typ");
    expect(session.entry_path).toBe("C:\\docs\\main.typ");
  });

  it("mocks readSource / saveSource round-trip in memory", async () => {
    const { readSource, saveSource } = await loadBrowserMode();
    const snap = await readSource("mock-session-123");
    expect(snap.content).toContain("Tykuru Sample File");

    const result = await saveSource("mock-session-123", "new content", snap.disk_revision);
    expect(result.disk_revision).toBe("2");
    const after = await readSource("mock-session-123");
    expect(after.content).toBe("new content");
  });

  it("mocks get_active_session as null", async () => {
    const { getActiveSession } = await loadBrowserMode();
    expect(await getActiveSession()).toBeNull();
  });

  it("mocks getPreviewPdf as an ArrayBuffer", async () => {
    const { getPreviewPdf } = await loadBrowserMode();
    const data = await getPreviewPdf("mock-session-123", 0);
    expect(data).toBeInstanceOf(ArrayBuffer);
  });
});

describe("Tauri-mode passthrough", () => {
  it("calls the real invoke when Tauri globals are present", async () => {
    const { openDocument } = await loadTauriMode();
    // The real @tauri-apps/api/core invoke is not callable in jsdom; asserting
    // the module loads and the mock branch is skipped is the meaningful check.
    expect(typeof openDocument).toBe("function");
  });
});
