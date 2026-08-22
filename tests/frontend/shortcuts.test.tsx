import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useGlobalShortcuts } from "@/app/use-global-shortcuts";
import { PreviewPane } from "@/preview/PreviewPane";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/bridge/commands", () => ({
  getPreviewPdf: vi.fn(async () => new ArrayBuffer(8)),
}));

vi.mock("@/preview/pdfjs", () => ({
  loadPdf: vi.fn(async () => ({
    numPages: 1,
    destroy: vi.fn(),
    getPage: vi.fn(async () => ({ getViewport: () => ({ width: 800, height: 600 }), render: () => ({}) })),
  })),
}));

function ShortcutProbe({ onOpen, onToggle }: { onOpen: () => void; onToggle: () => void }) {
  useGlobalShortcuts({ onOpen, onToggleEditor: onToggle });
  return (
    <div>
      <button onClick={onOpen}>open</button>
      <button onClick={onToggle}>toggle</button>
    </div>
  );
}

describe("global shortcuts", () => {
  it("Ctrl+O triggers open", () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<ShortcutProbe onOpen={onOpen} onToggle={onToggle} />);
    fireEvent.keyDown(window, { key: "o", ctrlKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("Ctrl+\\ toggles the editor", () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<ShortcutProbe onOpen={onOpen} onToggle={onToggle} />);
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("Ctrl+= and Ctrl+- and Ctrl+0 do not fire non-shortcut callbacks", () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<ShortcutProbe onOpen={onOpen} onToggle={onToggle} />);
    fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("preview zoom shortcuts", () => {
  it("Ctrl+= zoom in changes the zoom label", () => {
    render(<PreviewPane />);
    // Default is page-width ("Fit").
    expect(screen.getByText("Fit")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new CustomEvent("tykuru:shortcut-zoom-in"));
    });
    expect(screen.getByText("120%")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new CustomEvent("tykuru:shortcut-zoom-out"));
      window.dispatchEvent(new CustomEvent("tykuru:shortcut-zoom-out"));
    });
    expect(screen.getByText("80%")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new CustomEvent("tykuru:shortcut-zoom-reset"));
    });
    expect(screen.getByText("Fit")).toBeTruthy();
  });
});
