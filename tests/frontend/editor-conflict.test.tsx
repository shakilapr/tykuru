import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/app/app-state";
import { EditorPane } from "@/components/editor/EditorPane";
import { EditorView } from "@codemirror/view";

// Capture the `source-changed` listener so tests can simulate an external edit.
type EventHandler = (e: { payload: [string, string] }) => void;
const listeners = new Map<string, EventHandler[]>();
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: EventHandler) => {
    const arr = listeners.get(event) ?? [];
    arr.push(handler);
    listeners.set(event, arr);
    return Promise.resolve(() => {
      const a = listeners.get(event) ?? [];
      listeners.set(
        event,
        a.filter((h) => h !== handler),
      );
    });
  }),
}));

const readSource = vi.fn();
const saveSource = vi.fn();
const resolveConflict = vi.fn();
vi.mock("@/bridge/commands", () => ({
  readSource: (...a: unknown[]) => readSource(...a),
  saveSource: (...a: unknown[]) => saveSource(...a),
  resolveSourceConflictKeepLocal: (...a: unknown[]) => resolveConflict(...a),
}));

function emitSourceChanged(sessionId: string, revision: string) {
  act(() => {
    (listeners.get("source-changed") ?? []).forEach((h) =>
      h({ payload: [sessionId, revision] }),
    );
  });
}

function renderPane() {
  let view: EditorView | null = null;
  const result = render(
    <ThemeProvider>
      <EditorPane
        sessionId="sid-1"
        onViewReady={(v) => {
          view = v as EditorView;
        }}
      />
    </ThemeProvider>,
  );
  return { ...result, getView: () => view };
}

async function typeIn(view: EditorView, text: string) {
  act(() => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  });
  // Allow React to flush the state updates from the updateListener so the
  // dirty flag is reflected before the external-change event fires.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("EditorPane conflict flow", () => {
  beforeEach(() => {
    listeners.clear();
    readSource.mockReset();
    saveSource.mockReset();
    resolveConflict.mockReset();
    readSource.mockResolvedValue({
      sessionId: "sid-1",
      content: "= Hello\nworld",
      disk_revision: "rev-1",
    });
    saveSource.mockResolvedValue({ disk_revision: "rev-2" });
    resolveConflict.mockResolvedValue({ disk_revision: "rev-keep" });
  });

  it("silent clean reload on external change while clean", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");

    // External edit arrives while clean.
    readSource.mockResolvedValueOnce({
      sessionId: "sid-1",
      content: "= Hello\nexternally edited",
      disk_revision: "rev-B",
    });
    emitSourceChanged("sid-1", "rev-B");

    // No conflict; the buffer reflects the new disk content.
    await waitFor(() => {
      expect(getView()?.state.doc.toString()).toContain("externally edited");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dirty + external change enters conflict; autosave suspended", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");
    expect(listeners.has("source-changed")).toBe(true);

    await typeIn(getView() as EditorView, "= Local unsaved");
    await screen.findByLabelText("Unsaved changes");

    emitSourceChanged("sid-1", "rev-B");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Keep my version")).toBeInTheDocument();
    expect(screen.getByText("Reload external")).toBeInTheDocument();

    // Autosave is suspended: wait past the debounce, no save call.
    await new Promise((r) => setTimeout(r, 600));
    expect(saveSource).not.toHaveBeenCalled();
  });

  it("Keep my version calls resolve with the external revision and returns to clean", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");

    await typeIn(getView() as EditorView, "= Local unsaved");
    await screen.findByLabelText("Unsaved changes");
    emitSourceChanged("sid-1", "rev-B");

    const keep = await screen.findByText("Keep my version");
    act(() => {
      keep.click();
    });

    await waitFor(() => {
      expect(resolveConflict).toHaveBeenCalledWith("sid-1", "= Local unsaved", "rev-B");
    });
    await screen.findByLabelText("Saved");
  });

  it("rejected Keep shows file-changed-again and refreshes to the newest revision", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");

    await typeIn(getView() as EditorView, "= Local unsaved");
    await screen.findByLabelText("Unsaved changes");
    emitSourceChanged("sid-1", "rev-B");

    // Keep attempt fails because disk moved B → C.
    resolveConflict.mockRejectedValueOnce(new Error("conflict"));
    readSource.mockResolvedValueOnce({
      sessionId: "sid-1",
      content: "= Newer external C",
      disk_revision: "rev-C",
    });

    const keep = await screen.findByText("Keep my version");
    act(() => {
      keep.click();
    });

    await screen.findByText(/changed again/i);
    // The next Keep attempt should target the refreshed revision C.
    resolveConflict.mockResolvedValueOnce({ disk_revision: "rev-keep" });
    const keep2 = await screen.findByText("Keep my version");
    act(() => {
      keep2.click();
    });
    await waitFor(() => {
      expect(resolveConflict).toHaveBeenLastCalledWith("sid-1", "= Local unsaved", "rev-C");
    });
  });

  it("Reload external discards the local buffer and loads disk", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");

    await typeIn(getView() as EditorView, "= Local unsaved");
    await screen.findByLabelText("Unsaved changes");
    emitSourceChanged("sid-1", "rev-B");

    readSource.mockResolvedValueOnce({
      sessionId: "sid-1",
      content: "= Disk wins",
      disk_revision: "rev-B",
    });
    const reload = await screen.findByText("Reload external");
    act(() => {
      reload.click();
    });

    await waitFor(() => {
      expect(getView()?.state.doc.toString()).toBe("= Disk wins");
    });
    expect(await screen.findByLabelText("Saved")).toBeInTheDocument();
  });
});

