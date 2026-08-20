import { FolderOpen, PanelRight, ZoomIn, ZoomOut, MoreVertical, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/app/app-state";

export interface ToolbarProps {
  filename?: string;
  compileStatus?: "idle" | "compiling" | "ready" | "error";
  onOpen: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  previewActive?: boolean;
}

function StatusIcon({ status }: { status?: ToolbarProps["compileStatus"] }) {
  if (status === "error") return <span className="text-destructive">Error</span>;
  if (status === "compiling") return <span>Compiling…</span>;
  if (status === "ready") return <span>Ready</span>;
  return <span className="text-muted-foreground">Idle</span>;
}

function IconButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <Tooltip label={label}>
      <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled}>
        <Icon size={18} aria-hidden />
      </Button>
    </Tooltip>
  );
}

export function Toolbar({ filename, compileStatus, onOpen, onZoomIn, onZoomOut, previewActive }: ToolbarProps) {
  const { toggleEditor } = useAppState();
  return (
    <header className="flex h-12 items-center gap-2 border-b border-border px-2">
      <IconButton icon={FolderOpen} label="Open .typ" onClick={onOpen} />
      <IconButton icon={PanelRight} label="Toggle editor" onClick={toggleEditor} />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <span className="min-w-0 flex-1 truncate text-sm" title={filename}>
        {filename ?? "No document"}
      </span>
      <span className="text-xs text-muted-foreground">
        <StatusIcon status={compileStatus} />
      </span>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <IconButton icon={ZoomOut} label="Zoom out" onClick={onZoomOut} disabled={!previewActive} />
      <span className="w-12 text-center text-xs text-muted-foreground" aria-live="polite">
        {previewActive ? "100%" : "—"}
      </span>
      <IconButton icon={ZoomIn} label="Zoom in" onClick={onZoomIn} disabled={!previewActive} />
      <IconButton icon={MoreVertical} label="More" />
    </header>
  );
}
