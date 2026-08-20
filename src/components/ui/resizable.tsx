import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResizablePanelsProps {
  editorVisible: boolean;
  /** fraction (0..1) of width given to the editor when visible */
  editorRatio: number;
  editor: React.ReactNode;
  preview: React.ReactNode;
  onEditorRatioChange?: (ratio: number) => void;
  className?: string;
}

/**
 * Minimal two-pane resizable layout. When the editor is hidden the preview
 * takes the full width (data-state reflects the expanded preview so tests can
 * assert width reclamation). A native range input provides the drag handle
 * without external dependencies.
 */
export function ResizablePanels({
  editorVisible,
  editorRatio,
  editor,
  preview,
  onEditorRatioChange,
  className,
}: ResizablePanelsProps) {
  const pct = Math.round(editorRatio * 100);
  return (
    <div className={cn("flex h-full w-full", className)}>
      {editorVisible && (
        <div
          className="h-full min-w-0 overflow-hidden border-r border-border"
          style={{ width: `${pct}%`, flex: `0 0 ${pct}%` }}
          data-state="editor"
          aria-label="Editor pane"
        >
          {editor}
        </div>
      )}
      <div
        className="h-full min-w-0 flex-1"
        data-state={editorVisible ? "split" : "preview-expanded"}
        aria-label="Preview pane"
      >
        {preview}
      </div>
      {editorVisible && onEditorRatioChange && (
        <input
          type="range"
          min={20}
          max={80}
          value={pct}
          aria-label="Editor width"
          className="w-2 self-stretch"
          onChange={(e) => onEditorRatioChange(Number(e.target.value) / 100)}
        />
      )}
    </div>
  );
}
