import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { ThemeProvider, useAppState } from "@/app/app-state";
import AppLayout from "@/app/AppLayout";
import { StartScreen } from "@/components/StartScreen";
import { getActiveSession, openDocument, openDocumentDialog } from "@/bridge/commands";
import { SESSION_OPENED } from "@/bridge/events";
import type { SessionSummary } from "@/bridge/types";
import { useGlobalShortcuts } from "@/app/use-global-shortcuts";

function Root() {
  const { documentState, openingDocumentState, openDocumentState, errorDocumentState, toggleEditor } =
    useAppState();

  const openFromDialog = useCallback(async () => {
    openingDocumentState();
    try {
      const session = await openDocumentDialog();
      if (session) openDocumentState(session.id, session.filename);
    } catch (e) {
      errorDocumentState(e instanceof Error ? e.message : String(e));
    }
  }, [openingDocumentState, openDocumentState, errorDocumentState]);

  const openFromPath = useCallback(
    async (path: string) => {
      openingDocumentState();
      try {
        const session = await openDocument(path);
        openDocumentState(session.id, session.filename);
      } catch (e) {
        errorDocumentState(e instanceof Error ? e.message : String(e));
      }
    },
    [openingDocumentState, openDocumentState, errorDocumentState],
  );

  // Global keyboard shortcuts (Stage 16). Ctrl+S and Ctrl+F are delivered by
  // the CodeMirror editor when it is focused; the global listener only handles
  // the non-editor actions.
  useGlobalShortcuts({ onOpen: openFromDialog, onToggleEditor: toggleEditor });

  // Browser-mode convenience: when running against the Vite dev server without
  // Tauri (no IPC surface), auto-open a sample document so the UI is usable.
  // Fires once on mount; the `empty`-state guard prevents duplicate opens.
  useEffect(() => {
    const isBrowser = !window.__TAURI_INTERNALS__ && !window.__TAURI_IPC__;
    if (isBrowser && documentState.kind === "empty") {
      void openFromPath("sample.typ");
    }
  }, []);

  // Recover a session opened before this page mounted. The backend opens a
  // launch-argument document during `.setup()`, which runs before the React
  // page exists, so the `session-opened` event may have fired already (Tauri
  // events are not buffered). Querying the active session on mount closes that
  // gap; the event subscription below covers opens while the UI is showing.
  const applySession = useCallback((session: SessionSummary) => {
    openDocumentState(session.id, session.filename);
  }, [openDocumentState]);

  useEffect(() => {
    const isBrowser = !window.__TAURI_INTERNALS__ && !window.__TAURI_IPC__;
    if (isBrowser) return;
    let cancelled = false;
    void getActiveSession().then((session) => {
      if (cancelled || !session || documentState.kind !== "empty") return;
      applySession(session);
    });
    return () => {
      cancelled = true;
    };
  }, [documentState.kind, applySession]);

  // Subscribe to `session-opened` (dialog, argv/Open With, drag-drop, and
  // single-instance forwarding). Re-listens when the doc state changes so the
  // subscription is fresh; the callback is a no-op if a document is already open.
  useEffect(() => {
    const isBrowser = !window.__TAURI_INTERNALS__ && !window.__TAURI_IPC__;
    if (isBrowser) return;
    const unlisten = listen<SessionSummary>(SESSION_OPENED, (e) => {
      applySession(e.payload);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [documentState.kind, applySession]);

  if (documentState.kind === "open") {
    return (
      <AppLayout
        sessionId={documentState.sessionId}
        filename={documentState.filename}
        onOpen={openFromDialog}
      />
    );
  }
  return (
    <StartScreen
      onOpen={openFromDialog}
      onOpenPath={openFromPath}
      error={documentState.kind === "error" ? documentState.message : null}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
