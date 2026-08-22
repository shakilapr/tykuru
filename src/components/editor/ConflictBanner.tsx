// Conflict banner (architecture §16.4): shown only while the editor has
// unsaved local edits AND the file changed externally. Never auto-resolves.

import { Button } from "@/components/ui/button";

export interface ConflictBannerProps {
  /** True when disk moved again during a Keep attempt (B → C). */
  changedAgain?: boolean;
  onReloadExternal: () => void;
  onKeepMyVersion: () => void;
}

export function ConflictBanner({ changedAgain, onReloadExternal, onKeepMyVersion }: ConflictBannerProps) {
  return (
    <div
      role="alert"
      className="m-2 flex flex-wrap items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span className="font-medium">File changed externally while you have unsaved edits.</span>
      {changedAgain ? (
        <span className="w-full text-xs">
          File changed again. Review the latest external version before overwriting.
        </span>
      ) : null}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onReloadExternal}>
          Reload external
        </Button>
        <Button variant="default" size="sm" onClick={onKeepMyVersion}>
          Keep my version
        </Button>
      </div>
    </div>
  );
}
