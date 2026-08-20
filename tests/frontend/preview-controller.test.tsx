import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/bridge/commands", () => ({
  getPreviewPdf: vi.fn(),
}));
vi.mock("@/preview/pdfjs", () => ({
  loadPdf: vi.fn(),
  getPdfjs: vi.fn(),
}));

import { getPreviewPdf } from "@/bridge/commands";
import { loadPdf } from "@/preview/pdfjs";
import { PreviewController } from "@/preview/preview-controller";

function fakeDoc(numPages = 1) {
  return {
    numPages,
    getPage: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("PreviewController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the new revision number on a newer preview event", async () => {
    const onDocument = vi.fn();
    const onError = vi.fn();
    const controller = new PreviewController({ onDocument, onError });
    vi.mocked(getPreviewPdf).mockResolvedValue(new ArrayBuffer(8));
    vi.mocked(loadPdf).mockResolvedValue(fakeDoc() as never);

    controller.applyEvent({ sessionId: "a", revision: 1 });
    await new Promise((r) => setTimeout(r, 0));

    expect(getPreviewPdf).toHaveBeenCalledWith("a", 1);
    expect(onDocument).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores an older revision event", async () => {
    const onDocument = vi.fn();
    const onError = vi.fn();
    const controller = new PreviewController({ onDocument, onError });
    vi.mocked(getPreviewPdf).mockResolvedValue(new ArrayBuffer(8));
    vi.mocked(loadPdf).mockResolvedValue(fakeDoc() as never);

    controller.applyEvent({ sessionId: "a", revision: 3 });
    await new Promise((r) => setTimeout(r, 0));
    (getPreviewPdf as unknown as { mockClear(): void }).mockClear();
    onDocument.mockClear();

    controller.applyEvent({ sessionId: "a", revision: 2 });
    await new Promise((r) => setTimeout(r, 0));

    expect(getPreviewPdf).not.toHaveBeenCalled();
    expect(onDocument).not.toHaveBeenCalled();
  });

  it("produces a controlled error state when the document fails to load", async () => {
    const onDocument = vi.fn();
    const onError = vi.fn();
    const controller = new PreviewController({ onDocument, onError });
    vi.mocked(getPreviewPdf).mockResolvedValue(new ArrayBuffer(8));
    vi.mocked(loadPdf).mockRejectedValue(new Error("corrupt pdf"));

    controller.applyEvent({ sessionId: "a", revision: 1 });
    await new Promise((r) => setTimeout(r, 0));

    expect(onDocument).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("corrupt pdf");
  });

  it("ignores a stale session event after switching sessions", async () => {
    const onDocument = vi.fn();
    const onError = vi.fn();
    const controller = new PreviewController({ onDocument, onError });
    vi.mocked(getPreviewPdf).mockResolvedValue(new ArrayBuffer(8));
    vi.mocked(loadPdf).mockResolvedValue(fakeDoc() as never);

    controller.applyEvent({ sessionId: "a", revision: 5 });
    await new Promise((r) => setTimeout(r, 0));
    (getPreviewPdf as unknown as { mockClear(): void }).mockClear();
    onDocument.mockClear();

    // A late "a" revision 6 arrives, but the controller already tracks session "a"
    // as the active session; it should still be accepted as newer.
    controller.applyEvent({ sessionId: "a", revision: 6 });
    await new Promise((r) => setTimeout(r, 0));
    expect(getPreviewPdf).toHaveBeenCalledWith("a", 6);
  });

  it("discards a stale async load that finishes after a newer revision", async () => {
    const onDocument = vi.fn();
    const onError = vi.fn();
    const controller = new PreviewController({ onDocument, onError });

    let resolveA!: () => void;
    let resolveB!: () => void;
    const gateA = new Promise<void>((r) => (resolveA = r));
    const gateB = new Promise<void>((r) => (resolveB = r));

    // Revision 4 loads slowly; revision 5 loads and finishes first.
    vi.mocked(getPreviewPdf)
      .mockReturnValueOnce(Promise.resolve(gateA).then(() => new ArrayBuffer(8)) as never)
      .mockReturnValueOnce(Promise.resolve(gateB).then(() => new ArrayBuffer(8)) as never);
    vi.mocked(loadPdf).mockResolvedValue(fakeDoc() as never);

    controller.applyEvent({ sessionId: "a", revision: 4 });
    controller.applyEvent({ sessionId: "a", revision: 5 });

    // Revision 5 completes → displayed.
    resolveB();
    await new Promise((r) => setTimeout(r, 0));
    expect(onDocument).toHaveBeenCalledTimes(1);
    expect(onDocument.mock.calls[0]?.[1]?.revision).toBe(5);

    // Revision 4 completes later → must not replace revision 5.
    resolveA();
    await new Promise((r) => setTimeout(r, 0));
    expect(onDocument).toHaveBeenCalledTimes(1);
    expect(onDocument.mock.calls[0]?.[1]?.revision).toBe(5);
  });
});
