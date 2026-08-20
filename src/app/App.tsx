import { useCallback } from "react";
import { ThemeProvider, useAppState } from "@/app/app-state";
import AppLayout from "@/app/AppLayout";
import { StartScreen } from "@/components/StartScreen";
import { openDocument, openDocumentDialog } from "@/bridge/commands";

function Root() {
  const { documentState, openingDocumentState, openDocumentState, errorDocumentState } = useAppState();

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

  if (documentState.kind === "open") {
    return <AppLayout filename={documentState.filename} onOpen={openFromDialog} />;
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
