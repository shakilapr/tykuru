// Lazy viewport rendering (architecture §14.2): render the visible page first,
// then ±1–2 neighbors, and only render farther pages lazily on scroll. Every
// page gets a placeholder at its real dimensions so the scrollbar is accurate
// without rasterizing the whole document.

import { useCallback, useEffect, useRef, useState } from "react";
import { PdfDocumentLike } from "./pdfjs";
import { clampPage, computeRelativeOffset, scrollTopForPage, ViewState } from "./view-state";

export interface PageLayout {
  width: number;
  height: number;
  scale: number;
}

export interface PdfViewerProps {
  doc: PdfDocumentLike | null;
  viewState: ViewState;
  containerWidth: number;
  /** Called with the current scroll position when the user scrolls. */
  onScrollChange?: (state: Pick<ViewState, "visiblePage" | "relativeOffset">) => void;
  /** Called when the first visible page of a document has rendered (§14.2). */
  onVisibleRendered?: (page: number) => void;
}

const NEIGHBOR_RADIUS = 2;

export function PdfViewer({
  doc,
  viewState,
  containerWidth,
  onScrollChange,
  onVisibleRendered,
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [rendered, setRendered] = useState<ReadonlySet<number>>(new Set());
  const [visiblePage, setVisiblePage] = useState(1);
  const renderTokenRef = useRef(0);
  const onVisibleRenderedRef = useRef(onVisibleRendered);
  onVisibleRenderedRef.current = onVisibleRendered;

  // Compute real page layouts once per document (getViewport is cheap; no
  // rasterization). This makes placeholders hold the correct height.
  useEffect(() => {
    if (!doc) {
      setLayouts([]);
      setRendered(new Set());
      return;
    }
    let cancelled = false;
    const scale =
      viewState.scaleMode === "page-width" && containerWidth > 0
        ? 0 // resolved per page below once width is known
        : viewState.scaleValue;
    const resolveScale = (baseWidth: number) =>
      viewState.scaleMode === "page-width" && containerWidth > 0
        ? containerWidth / baseWidth
        : scale;

    (async () => {
      const out: PageLayout[] = [];
      for (let i = 0; i < doc.numPages; i++) {
        if (cancelled) break;
        const page = await doc.getPage(i + 1);
        const base = page.getViewport({ scale: 1 });
        const s = resolveScale(base.width);
        out.push({ width: base.width * s, height: base.height * s, scale: s });
      }
      if (!cancelled) setLayouts(out);
    })();

    return () => {
      cancelled = true;
      renderTokenRef.current++;
    };
  }, [doc, viewState.scaleMode, viewState.scaleValue, containerWidth]);

  // Render the visible window (visible page ± NEIGHBOR_RADIUS), cancelling any
  // in-flight work when the window or document changes (§14.2).
  useEffect(() => {
    if (!doc || layouts.length === 0) return;
    const visible = visiblePage;
    const token = ++renderTokenRef.current;
    const lo = Math.max(1, visible - NEIGHBOR_RADIUS);
    const hi = Math.min(doc.numPages, visible + NEIGHBOR_RADIUS);
    const tasks: { cancel(): void }[] = [];

    const renderPage = async (i: number) => {
      const page = await doc.getPage(i + 1);
      if (renderTokenRef.current !== token) {
        page.cleanup();
        return;
      }
      const canvas = canvasRefs.current[i];
      const ctx = canvas?.getContext("2d");
      const layout = layouts[i];
      if (!canvas || !ctx || !layout) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(layout.width * dpr);
      canvas.height = Math.floor(layout.height * dpr);
      canvas.style.width = `${Math.floor(layout.width)}px`;
      canvas.style.height = `${Math.floor(layout.height)}px`;
      const viewport = page.getViewport({ scale: layout.scale });
      const task = page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      tasks.push(task as unknown as { cancel(): void });
      try {
        await task.promise;
      } catch {
        // cancelled/failed render; re-renders on next window change.
      }
      if (renderTokenRef.current !== token) return;
      setRendered((prev) => {
        const next = new Set(prev);
        next.add(i + 1);
        return next;
      });
      if (i + 1 === visible) {
        onVisibleRenderedRef.current?.(i + 1);
      }
    };

    // Render visible first, then neighbors outward.
    const order: number[] = [];
    for (let r = 0; r <= NEIGHBOR_RADIUS; r++) {
      if (visible - r >= lo) order.push(visible - r);
      if (r > 0 && visible + r <= hi) order.push(visible + r);
    }
    void Promise.all(order.map(renderPage));

    return () => {
      renderTokenRef.current++;
      tasks.forEach((t) => t.cancel());
    };
    // Re-render when the visible page or document/layout changes.
    // Deliberately scoped: renders only on these inputs.
  }, [doc, layouts, containerWidth, visiblePage]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const offsets = canvasRefs.current.map((c) => c?.offsetTop ?? 0);
    let visible = 1;
    for (let i = offsets.length - 1; i >= 0; i--) {
      const pageTop = offsets[i] ?? 0;
      if (el.scrollTop >= pageTop - 1) {
        visible = i + 1;
        break;
      }
    }
    const top = offsets[visible - 1] ?? 0;
    const height = canvasRefs.current[visible - 1]?.offsetHeight ?? 0;
    setVisiblePage(visible);
    onScrollChange?.({
      visiblePage: visible,
      relativeOffset: computeRelativeOffset(el.scrollTop, top, height),
    });
  }, [onScrollChange]);

  // Restore the viewport after the document/layout changes (§14.1). Runs when
  // the visible page has rendered so the scrollbar is accurate.
  useEffect(() => {
    if (!doc || layouts.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const page = clampPage(viewState.visiblePage, doc.numPages);
    const tops = canvasRefs.current.map((c) => c?.offsetTop ?? 0);
    const heights = layouts.map((l) => l.height);
    const target = scrollTopForPage(page, viewState.relativeOffset, tops, heights);
    el.scrollTop = target;
    setVisiblePage(page);
    // Runs once per doc/layout change to restore the viewport (§14.1).
  }, [doc, layouts]);

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
      {Array.from({ length: doc.numPages }, (_, i) => {
        const layout = layouts[i];
        const isRendered = rendered.has(i + 1);
        return (
          <canvas
            key={i}
            ref={(el) => {
              canvasRefs.current[i] = el;
            }}
            className="shadow"
            style={{
              width: layout ? `${Math.floor(layout.width)}px` : undefined,
              height: layout ? `${Math.floor(layout.height)}px` : undefined,
            }}
            data-rendered={isRendered || undefined}
          />
        );
      })}
    </div>
  );
}
