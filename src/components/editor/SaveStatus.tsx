// Save indicator: saved / saving / dirty (architecture §15).

import type { SaveStatus } from "@/editor/editor-state";

export function SaveStatus({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="text-xs text-muted-foreground" role="status" aria-label="Saving">
        Saving…
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="text-xs text-muted-foreground" role="status" aria-label="Unsaved changes">
        Unsaved
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground" role="status" aria-label="Saved">
      Saved
    </span>
  );
}
