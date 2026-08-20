// Localized PDF.js access point.
//
// Centralizing the `pdfjs-dist` import and worker configuration here keeps the
// heavy dependency out of the controller/logic modules and makes it trivial to
// mock in tests (architecture §7.2: logic is framework-agnostic).

import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getViewport(params: { scale: number }): { width: number; height: number };
    render(params: unknown): { promise: Promise<void>; cancel(): void };
    cleanup(): void;
  }>;
  destroy(): Promise<void>;
}

export function getPdfjs() {
  return pdfjsLib;
}

/// Loads a PDF document from in-memory bytes (ArrayBuffer → Uint8Array).
export function loadPdf(data: ArrayBuffer): Promise<PdfDocumentLike> {
  const bytes = new Uint8Array(data);
  // pdfjs expects a copy it can transfer; clone to be safe.
  return pdfjsLib.getDocument({ data: bytes.slice().buffer }).promise as Promise<PdfDocumentLike>;
}
