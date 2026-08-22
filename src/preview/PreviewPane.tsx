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
  // The document that is actively displayed; when a newer revision is loading
  // we keep the previous one until its first visible page has rendered (§14.2).
  const [displayedDoc, setDisplayedDoc] = useState<PdfDocumentLike | null>(null);
  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const compileState = useCompileState();
  // T0–T5 latency instrumentation (§14.3).
  const timingsRef = useRef<{ [k: string]: number }>({});

  const controllerRef = useRef<PreviewController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PreviewController({
      onDocument: (d) => {
        // Begin loading the new revision; keep the old doc displayed until the
        // new visible page renders (see onVisibleRendered below).
        timingsRef.current["T4"] = performance.now();
        setDoc(d);
        setError(null);
      },
      onError: (msg) => setError(msg),
    });
  }

  // Swap to the new doc once its visible page has rendered, and record T5.
  const onVisibleRendered = useCallback(
    (page: number) => {
      timingsRef.current["T5"] = performance.now();
      setDisplayedDoc((prev) => {
        if (prev && prev !== doc) {
          void prev.destroy();
        }
        return doc;
      });
      const t = timingsRef.current;
      const log: string[] = [];
      for (const k of ["T0", "T1", "T2", "T3", "T4", "T5"]) {
        if (t[k] !== undefined) log.push(`${k}=${t[k].toFixed(1)}`);
      }
      if (t.T0 !== undefined && t.T5 !== undefined) {
        log.push(`T5-T0=${(t.T5 - t.T0).toFixed(1)}ms`);
      }
      console.debug("[preview-latency]", page, log.join(" "));
    },
    [doc],
  );

  useEffect(() => {
    const unlisten = listen<[string, number]>(PREVIEW_UPDATED, (e) => {
      const [sessionId, revision] = e.payload;
      // T3: frontend notified of a new preview revision (§14.3).
      timingsRef.current["T3"] = performance.now();
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

  const onScrollChange = useCallback(
    (pos: Pick<ViewState, "visiblePage" | "relativeOffset">) =>
      setViewState((s) => ({ ...s, ...pos })),
    [],
  );

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
        <PdfViewer
          doc={displayedDoc ?? doc}
          viewState={viewState}
          containerWidth={width}
          onScrollChange={onScrollChange}
          onVisibleRendered={onVisibleRendered}
        />
      </div>
    </div>
  );
}
