import type { CompileState } from "@/bridge/types";

export interface DiagnosticBannerProps {
  state: CompileState;
}

/// Compact banner shown only when compilation is in an `Error` state. The last
/// good preview remains visible underneath (architecture §12.3); this banner
/// only surfaces the bounded diagnostic text.
export function DiagnosticBanner({ state }: DiagnosticBannerProps) {
  if (state.status !== "error") return null;
  return (
    <div
      role="alert"
      className="m-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span className="font-medium">Compile error:</span> {state.message ?? "Unknown error"}
    </div>
  );
}
