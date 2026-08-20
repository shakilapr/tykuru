import { useEffect, useRef } from "react";
import { PdfDocumentLike } from "./pdfjs";
import { clampPage, computeRelativeOffset, scrollTopForPage, ViewState } from "./view-state";

export interface PdfViewerProps {
  doc: PdfDocumentLike | null;
  viewState: ViewState;
  containerWidth: number;
  /** Called with the current scroll position when the user scrolls. */
  onScrollChange?: (state: Pick<ViewState, "visiblePage" | "relativeOffset">) => void;
}

export function PdfViewer({ doc, viewState, containerWidth, onScrollChange }: PdfViewerProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const tasks: { cancel(): void }[] = [];
    const layout: { tops: number[]; heights: number[] } = { tops: [], heights: [] };

    const renderPages = async () => {
      for (let i = 0; i < doc.numPages; i++) {
        if (cancelled) break;
        const page = await doc.getPage(i + 1);
        const canvas = canvasRefs.current[i];
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) continue;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale =
          viewState.scaleMode === "page-width" && containerWidth > 0
            ? containerWidth / baseViewport.width
            : viewState.scaleValue;
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        layout.tops[i] = canvas.offsetTop;
        layout.heights[i] = canvas.offsetHeight;
        const task = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        tasks.push(task as unknown as { cancel(): void });
        try {
          await task.promise;
        } catch {
          // cancelled/failed render; next revision re-renders.
        }
      }
    };

    void renderPages().then(() => {
      if (cancelled) return;
      // Restore the previous viewport (architecture §14.1). Page layout lives
      // only in the DOM, so restore happens after canvases have sized themselves.
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const page = clampPage(viewState.visiblePage, doc.numPages);
      scrollEl.scrollTop = scrollTopForPage(page, viewState.relativeOffset, layout.tops, layout.heights);
    });

    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [doc, viewState, containerWidth]);

  const handleScroll = () => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    // Determine the visible page from canvas offsets, then the fractional
    // position within it (architecture §14.1).
    const offsets = canvasRefs.current.map((c) => c?.offsetTop ?? 0);
    let visible = 1;
    for (let i = offsets.length - 1; i >= 0; i--) {
      const pageTop = offsets[i] ?? 0;
      if (scrollEl.scrollTop >= pageTop - 1) {
        visible = i + 1;
        break;
      }
    }
    const top = offsets[visible - 1] ?? 0;
    const height = canvasRefs.current[visible - 1]?.offsetHeight ?? 0;
    onScrollChange?.({
      visiblePage: visible,
      relativeOffset: computeRelativeOffset(scrollEl.scrollTop, top, height),
    });
  };

  if (!doc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Preview will appear here.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="mx-auto flex h-full w-full flex-col items-center gap-2 overflow-auto bg-muted p-2"
      aria-label="PDF preview"
      onScroll={handleScroll}
    >
      {Array.from({ length: doc.numPages }, (_, i) => (
        <canvas key={i} ref={(el) => (canvasRefs.current[i] = el)} className="shadow" />
      ))}
    </div>
  );
}
