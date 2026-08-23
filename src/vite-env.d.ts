/// <reference types="vite/client" />

// Tauri injects these into the WebView at runtime; they are absent in a plain
// browser (Vite dev server without Tauri). Typed so the browser-mode fallback
// in `src/bridge/commands.ts` can detect the runtime environment.
interface Window {
  __TAURI_INTERNALS__?: unknown;
  __TAURI_IPC__?: unknown;
}

