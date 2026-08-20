import { Toolbar } from "@/components/toolbar/Toolbar";
import { WorkspaceSplit } from "@/components/layout/WorkspaceSplit";

export default function AppLayout({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar onOpen={onOpen} />
      <div className="min-h-0 flex-1">
        <WorkspaceSplit />
      </div>
    </div>
  );
}
