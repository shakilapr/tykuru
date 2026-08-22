import { Toolbar } from "@/components/toolbar/Toolbar";
import { WorkspaceSplit } from "@/components/layout/WorkspaceSplit";
import { useCompileState } from "@/preview/use-compile-state";
import { setProjectRootDialog } from "@/bridge/commands";

export default function AppLayout({
  sessionId,
  filename,
  onOpen,
}: {
  sessionId?: string;
  filename?: string;
  onOpen: () => void;
}) {
  const compileState = useCompileState();

  const onSetProjectRoot = async () => {
    if (!sessionId) return;
    try {
      await setProjectRootDialog(sessionId);
    } catch (e) {
      console.error("Failed to set project root", e);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar
        filename={filename}
        compileStatus={compileState.status}
        onOpen={onOpen}
        onSetProjectRoot={onSetProjectRoot}
      />
      <div className="min-h-0 flex-1">
        <WorkspaceSplit sessionId={sessionId} />
      </div>
    </div>
  );
}
