import { useCallback } from "react";
import { ThemeProvider, useAppState } from "@/app/app-state";
import AppLayout from "@/app/AppLayout";
import { StartScreen } from "@/components/StartScreen";
import { openDocument, openDocumentDialog } from "@/bridge/commands";
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
