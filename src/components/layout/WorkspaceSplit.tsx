import { useAppState } from "@/app/app-state";
import { EditorPane } from "@/components/editor/EditorPane";
import { PreviewPane } from "@/components/preview/PreviewPane";
import { ResizablePanels } from "@/components/ui/resizable";

export function WorkspaceSplit() {
  const { editorVisible, splitRatio, setSplitRatio } = useAppState();
  return (
    <ResizablePanels
      editorVisible={editorVisible}
      editorRatio={splitRatio}
      onEditorRatioChange={setSplitRatio}
      editor={<EditorPane />}
      preview={<PreviewPane />}
    />
  );
}
