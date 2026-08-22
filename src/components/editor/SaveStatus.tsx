// Save indicator: saved / saving / dirty / conflict (architecture §15, §16).

export type SaveStatusValue = "saved" | "saving" | "dirty" | "conflict";

export function SaveStatus({ status }: { status: SaveStatusValue }) {
  if (status === "conflict") {
    return (
      <span className="text-xs font-medium text-destructive" role="status" aria-label="Conflict">
        Conflict
      </span>
    );
  }
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
