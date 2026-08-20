import { useCallback } from "react";
import { ThemeProvider, useAppState } from "@/app/app-state";
import AppLayout from "@/app/AppLayout";
import { StartScreen } from "@/components/StartScreen";
import { compileDocument, openDocument, openDocumentDialog } from "@/bridge/commands";

function Root() {
  const { documentState, openingDocumentState, openDocumentState, errorDocumentState } = useAppState();

  const afterOpen = useCallback(
    async (sessionId: string) => {
      // Stage 5 vertical: one-shot compile so the candidate watcher produces a
      // committed revision. Stage 6 replaces this with `typst watch`.
      try {
        await compileDocument(sessionId);
      } catch (e) {
        errorDocumentState(e instanceof Error ? e.message : String(e));
      }
    },
    [openDocumentState, errorDocumentState],
  );

  const openFromDialog = useCallback(async () => {
    openingDocumentState();
    try {
      const session = await openDocumentDialog();
      if (session) {
        openDocumentState(session.id, session.filename);
        void afterOpen(session.id);
      }
    } catch (e) {
      errorDocumentState(e instanceof Error ? e.message : String(e));
    }
  }, [openingDocumentState, openDocumentState, errorDocumentState, afterOpen]);

  const openFromPath = useCallback(
    async (path: string) => {
      openingDocumentState();
      try {
        const session = await openDocument(path);
        openDocumentState(session.id, session.filename);
        void afterOpen(session.id);
      } catch (e) {
        errorDocumentState(e instanceof Error ? e.message : String(e));
      }
    },
    [openingDocumentState, openDocumentState, errorDocumentState, afterOpen],
  );

  if (documentState.kind === "open") {
    return (
      <ThemeProvider>
        <AppLayout filename={documentState.filename} onOpen={openFromDialog} />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <StartScreen
        onOpen={openFromDialog}
        onOpenPath={openFromPath}
        error={documentState.kind === "error" ? documentState.message : null}
      />
    </ThemeProvider>
  );
}

export default function App() {
  return <Root />;
}
