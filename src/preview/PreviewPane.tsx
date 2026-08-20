import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PREVIEW_UPDATED } from "@/bridge/events";
import { PreviewController } from "./preview-controller";
import { PdfDocumentLike } from "./pdfjs";
import { PdfViewer } from "./PdfViewer";
import { DEFAULT_VIEW_STATE, resetZoom, ViewState, zoomIn, zoomOut } from "./view-state";
import { useCompileState } from "./use-compile-state";
import { DiagnosticBanner } from "@/components/preview/DiagnosticBanner";
import { Button } from "@/components/ui/button";

export function PreviewPane() {
  const [doc, setDoc] = useState<PdfDocumentLike | null>(null);
  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const compileState = useCompileState();

  const controllerRef = useRef<PreviewController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PreviewController({
      onDocument: (d) => {
        setDoc(d);
        setError(null);
      },
      onError: (msg) => setError(msg),
    });
  }

  useEffect(() => {
    const unlisten = listen<[string, number]>(PREVIEW_UPDATED, (e) => {
      const [sessionId, revision] = e.payload;
      controllerRef.current?.applyEvent({ sessionId, revision });
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const onZoomIn = useCallback(() => setViewState((s) => zoomIn(s)), []);
  const onZoomOut = useCallback(() => setViewState((s) => zoomOut(s)), []);
  const onReset = useCallback(() => setViewState((s) => resetZoom(s)), []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-9 items-center gap-1 border-b border-border px-2">
        <Button variant="ghost" size="sm" aria-label="Zoom out" onClick={onZoomOut}>
          −
        </Button>
        <span className="w-12 text-center text-xs text-muted-foreground" aria-live="polite">
          {viewState.scaleMode === "page-width" ? "Fit" : `${Math.round(viewState.scaleValue * 100)}%`}
        </span>
        <Button variant="ghost" size="sm" aria-label="Zoom in" onClick={onZoomIn}>
          +
        </Button>
        <Button variant="ghost" size="sm" aria-label="Reset zoom" onClick={onReset}>
          Reset
        </Button>
      </div>
      <DiagnosticBanner state={compileState} />
      {error ? (
        <div role="alert" className="m-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div ref={containerRef} className="min-h-0 flex-1">
        <PdfViewer doc={doc} viewState={viewState} containerWidth={width} />
      </div>
    </div>
  );
}
