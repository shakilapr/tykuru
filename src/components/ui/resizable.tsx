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
      {/* The editor stays mounted when collapsed so CodeMirror keeps its buffer
          and undo history; `hidden` removes it from layout/accessibility (§15). */}
      <div
        className="h-full min-w-0 overflow-hidden border-r border-border"
        style={editorVisible ? { width: `${pct}%`, flex: `0 0 ${pct}%` } : undefined}
        data-state={editorVisible ? "editor" : "editor-hidden"}
        aria-label="Editor pane"
        hidden={!editorVisible}
      >
        {editor}
      </div>
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
