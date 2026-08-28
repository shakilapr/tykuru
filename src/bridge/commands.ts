// Typed wrappers around Tauri `invoke` for document commands.
// This is the ONLY place the frontend calls into document IPC (architecture §6.1).

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { OpenDocumentResult, SessionSummary } from "./types";

const MOCK_SESSION_ID = "mock-session-123";
let mockContent = `= Tykuru Sample File
This is a test of the Tykuru editor.

* Bold text* and _italic text_.

- Bullet list
- Item 2
`;

// True when running in a plain browser (Vite dev without Tauri), where the
// backend is absent and commands are mocked locally.
function isBrowserMode(): boolean {
  return !window.__TAURI_INTERNALS__ && !window.__TAURI_IPC__;
}

type MockArgs = Record<string, unknown> | undefined;

async function invoke<T>(cmd: string, args?: MockArgs): Promise<T> {
  if (!isBrowserMode()) {
    return tauriInvoke(cmd, args);
  }

  console.log("[mock-ipc]", cmd, args);
  switch (cmd) {
    case "get_active_session":
      return null as T;
    case "open_document_dialog":
    case "open_document": {
      const path = typeof args?.path === "string" ? args.path : "sample.typ";
      const filename = path.split(/[\\/]/).pop() || "sample.typ";
      const result: OpenDocumentResult = {
        session: { id: MOCK_SESSION_ID, filename, entry_path: path },
      };
      return result as unknown as T;
    }
    case "read_source_command":
      return { session_id: MOCK_SESSION_ID, content: mockContent, disk_revision: "1" } as unknown as T;
    case "save_source_command":
      if (typeof args?.content === "string") mockContent = args.content;
      return { disk_revision: "2" } as unknown as T;
    case "resolve_source_conflict_keep_local_command":
      if (typeof args?.content === "string") mockContent = args.content;
      return { disk_revision: "2" } as unknown as T;
    case "get_preview_pdf_command": {
      // Browser mode has no real compiled PDF; return an empty buffer so the
      // viewer shows an empty canvas rather than erroring on missing IPC.
      try {
        const res = await fetch("/sample.pdf");
        if (!res.ok) throw new Error("sample.pdf not found");
        return (await res.arrayBuffer()) as unknown as T;
      } catch {
        return new ArrayBuffer(0) as unknown as T;
      }
    }
    case "compile_document":
      return { success: true, exitCode: 0, stderr: "", candidatePath: "mock" } as unknown as T;
    case "close_document":
    case "set_project_root":
    case "set_project_root_dialog":
      return undefined as T;
    default:
      console.warn("[mock-ipc] unmocked command:", cmd);
      return null as T;
  }
}

export async function openDocumentDialog(): Promise<SessionSummary | null> {
  const result = await invoke<OpenDocumentResult | null>("open_document_dialog");
  return result ? result.session : null;
}

export async function openDocument(path: string): Promise<SessionSummary> {
  const result = await invoke<OpenDocumentResult>("open_document", { path });
  return result.session;
}

export async function closeDocument(sessionId: string): Promise<void> {
  await invoke<void>("close_document", { sessionId });
}

export async function getActiveSession(): Promise<SessionSummary | null> {
  return invoke<SessionSummary | null>("get_active_session");
}

export interface CompileOutcome {
  success: boolean;
  exitCode: number | null;
  stderr: string;
  candidatePath: string;
}

export async function compileDocument(sessionId: string): Promise<CompileOutcome> {
  return invoke<CompileOutcome>("compile_document", { sessionId });
}

export async function setProjectRoot(sessionId: string, root: string): Promise<void> {
  await invoke<void>("set_project_root", { sessionId, root });
}

/** Opens the native folder picker and applies the chosen project root. */
export async function setProjectRootDialog(sessionId: string): Promise<void> {
  await invoke<void>("set_project_root_dialog", { sessionId });
}

export async function getPreviewPdf(sessionId: string, revision: number): Promise<ArrayBuffer> {
  return invoke<ArrayBuffer>("get_preview_pdf_command", { sessionId, revision });
}

export interface SourceSnapshot {
  session_id: string;
  content: string;
  disk_revision: string;
}

export interface SaveResult {
  disk_revision: string;
}

export async function readSource(sessionId: string): Promise<SourceSnapshot> {
  return invoke<SourceSnapshot>("read_source_command", { sessionId });
}

export async function saveSource(
  sessionId: string,
  content: string,
  expectedDiskRevision: string,
): Promise<SaveResult> {
  return invoke<SaveResult>("save_source_command", { sessionId, content, expectedDiskRevision });
}

/** Deliberate, user-authorized conflict resolution ("Keep my version"). */
export async function resolveSourceConflictKeepLocal(
  sessionId: string,
  content: string,
  expectedExternalRevision: string,
): Promise<SaveResult> {
  return invoke<SaveResult>("resolve_source_conflict_keep_local_command", {
    sessionId,
    content,
    expectedExternalRevision,
  });
}
