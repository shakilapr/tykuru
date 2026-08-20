import { useCallback, useState } from "react";
import { useAppState } from "@/app/app-state";
import { EditorPane } from "@/components/editor/EditorPane";
import { PreviewPane } from "@/preview/PreviewPane";
import { ResizablePanels } from "@/components/ui/resizable";
import { openDocument } from "@/bridge/commands";

export function WorkspaceSplit() {
  const { editorVisible, splitRatio, setSplitRatio, openDocumentState, errorDocumentState } = useAppState();
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const path = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      if (!path) return;
      try {
        const session = await openDocument(path);
        openDocumentState(session.id, session.filename);
      } catch (err) {
        errorDocumentState(err instanceof Error ? err.message : String(err));
      }
    },
    [openDocumentState, errorDocumentState],
  );

  return (
    <div
      className={`h-full w-full ${dragOver ? "outline-2 outline-dashed outline-primary" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <ResizablePanels
        editorVisible={editorVisible}
        editorRatio={splitRatio}
        onEditorRatioChange={setSplitRatio}
        editor={<EditorPane />}
        preview={<PreviewPane />}
      />
    </div>
  );
}
