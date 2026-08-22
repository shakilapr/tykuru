// Typed wrappers around Tauri `invoke` for document commands.
// This is the ONLY place the frontend calls into document IPC (architecture §6.1).

import { invoke } from "@tauri-apps/api/core";
import type { OpenDocumentResult, SessionSummary } from "./types";

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
  sessionId: string;
  content: string;
  diskRevision: string;
}

export interface SaveResult {
  diskRevision: string;
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
