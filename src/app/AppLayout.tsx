import { Toolbar } from "@/components/toolbar/Toolbar";
import { WorkspaceSplit } from "@/components/layout/WorkspaceSplit";
import { useCompileState } from "@/preview/use-compile-state";

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
  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar filename={filename} compileStatus={compileState.status} onOpen={onOpen} />
      <div className="min-h-0 flex-1">
        <WorkspaceSplit sessionId={sessionId} />
      </div>
    </div>
  );
}
