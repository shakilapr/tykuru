import { Toolbar } from "@/components/toolbar/Toolbar";
import { WorkspaceSplit } from "@/components/layout/WorkspaceSplit";
import { useCompileState } from "@/preview/use-compile-state";

export default function AppLayout({ filename, onOpen }: { filename?: string; onOpen: () => void }) {
  const compileState = useCompileState();
  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar filename={filename} compileStatus={compileState.status} onOpen={onOpen} />
      <div className="min-h-0 flex-1">
        <WorkspaceSplit />
      </div>
    </div>
  );
}
