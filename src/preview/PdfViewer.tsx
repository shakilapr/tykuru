import { useEffect, useRef } from "react";
import { PdfDocumentLike } from "./pdfjs";
import { ViewState } from "./view-state";

export interface PdfViewerProps {
  doc: PdfDocumentLike | null;
  viewState: ViewState;
  containerWidth: number;
}

export function PdfViewer({ doc, viewState, containerWidth }: PdfViewerProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const tasks: { cancel(): void }[] = [];

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

    void renderPages();
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [doc, viewState, containerWidth]);

  if (!doc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Preview will appear here.
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex h-full w-full flex-col items-center gap-2 overflow-auto bg-muted p-2"
      aria-label="PDF preview"
    >
      {Array.from({ length: doc.numPages }, (_, i) => (
        <canvas key={i} ref={(el) => (canvasRefs.current[i] = el)} className="shadow" />
      ))}
    </div>
  );
}
