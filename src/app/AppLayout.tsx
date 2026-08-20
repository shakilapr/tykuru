import { Toolbar } from "@/components/toolbar/Toolbar";
import { WorkspaceSplit } from "@/components/layout/WorkspaceSplit";

export default function AppLayout({ filename, onOpen }: { filename?: string; onOpen: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar filename={filename} onOpen={onOpen} />
      <div className="min-h-0 flex-1">
        <WorkspaceSplit />
      </div>
    </div>
  );
}
