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

// Settings (architecture §18). Mirror of `src-tauri/src/settings/model.rs`.
export type Theme = "system" | "light" | "dark";

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface SettingsV1 {
  version: number;
  theme: Theme;
  editor_visible: boolean;
  split_ratio: number;
  recent_files: { files: string[] };
  root_overrides: Record<string, string>;
  window_state: WindowState | null;
}

export interface SettingsPatch {
  theme?: Theme;
  editor_visible?: boolean;
  split_ratio?: number;
  recent_files?: string[];
  root_overrides?: Record<string, string>;
  window_state?: WindowState | null;
}
