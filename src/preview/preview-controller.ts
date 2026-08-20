// Preview controller: turns `preview-updated` events into PDF.js loads.
//
// Framework-agnostic logic (no React). It validates revision identity, fetches
// the committed revision over binary IPC, and hands the loaded document to a
// renderer callback. Stale sessions and older revisions are rejected (§12.2).

import { getPreviewPdf } from "@/bridge/commands";
import { DisplayedState, isNewerRevision, isSameSession, PreviewEvent } from "./revision-guard";
import { loadPdf, PdfDocumentLike } from "./pdfjs";

export interface PreviewControllerHandlers {
  onDocument: (doc: PdfDocumentLike, event: PreviewEvent) => void;
  onError: (message: string) => void;
}

export class PreviewController {
  private displayed: DisplayedState = { sessionId: null, revision: null };
  private loading: PreviewEvent | null = null;

  constructor(private handlers: PreviewControllerHandlers) {}

  /// Apply an incoming `preview-updated` event, loading only if it is the active
  /// session and strictly newer than what is displayed.
  applyEvent(event: PreviewEvent): void {
    const current = this.displayed;
    if (this.loading && this.loading.sessionId === event.sessionId && this.loading.revision >= event.revision) {
      return;
    }
    if (!isSameSession(current, event) || isNewerRevision(current, event)) {
      void this.load(event);
    }
  }

  /// Forces a load regardless (used on first open / session switch).
  load(event: PreviewEvent): Promise<void> {
    this.loading = event;
    return this.doLoad(event).finally(() => {
      if (this.loading && this.loading.revision === event.revision && this.loading.sessionId === event.sessionId) {
        this.loading = null;
      }
    });
  }

  private async doLoad(event: PreviewEvent): Promise<void> {
    try {
      const data = await getPreviewPdf(event.sessionId, event.revision);
      // Re-check identity after the fetch: a newer revision (or a session
      // switch) may have been displayed while we were loading. `isNewerRevision`
      // is false when `displayed` already holds an equal-or-newer revision of
      // the same session, so a stale in-flight load is discarded on arrival.
      if (!isNewerRevision(this.displayed, event)) {
        return;
      }
      const doc = await loadPdf(data);
      this.displayed = { sessionId: event.sessionId, revision: event.revision };
      this.handlers.onDocument(doc, event);
    } catch (e) {
      this.handlers.onError(e instanceof Error ? e.message : String(e));
    }
  }

  get displayedRevision(): DisplayedState {
    return this.displayed;
  }
}
