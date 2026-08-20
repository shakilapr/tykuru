// Types mirroring Rust command/event payloads (architecture §6.1, §6.2.2).
// Keep in sync with `src-tauri/src/commands/document.rs`.

export type SessionId = string;

export interface SessionSummary {
  id: SessionId;
  filename: string;
  entry_path: string;
}

export interface OpenDocumentResult {
  session: SessionSummary;
}

export type CompileStatus = "idle" | "compiling" | "ready" | "error";

export interface CompileState {
  status: CompileStatus;
  revision?: number;
  message?: string;
  lastGoodRevision?: number | null;
}
