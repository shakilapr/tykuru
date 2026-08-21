import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/app/app-state";
import { EditorPane } from "@/components/editor/EditorPane";
import { EditorView } from "@codemirror/view";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const readSource = vi.fn();
const saveSource = vi.fn();
vi.mock("@/bridge/commands", () => ({
  readSource: (...a: unknown[]) => readSource(...a),
  saveSource: (...a: unknown[]) => saveSource(...a),
}));

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

function typeIn(view: EditorView, text: string) {
  act(() => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  });
}

async function flushAsync() {
  await act(async () => {
    // Allow promise microtasks + the real 250ms debounce to settle.
    await new Promise((r) => setTimeout(r, 600));
  });
}

describe("EditorPane", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    readSource.mockReset();
    saveSource.mockReset();
    readSource.mockResolvedValue({
      sessionId: "sid-1",
      content: "= Hello\nworld",
      diskRevision: "rev-1",
    });
    saveSource.mockResolvedValue({ diskRevision: "rev-2" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the source and shows Saved initially", async () => {
    renderPane();
    expect(await screen.findByLabelText("Saved")).toBeInTheDocument();
    expect(readSource).toHaveBeenCalledWith("sid-1");
  });

  it("marks dirty when the buffer changes", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");

    const view = getView();
    expect(view).not.toBeNull();
    typeIn(view as EditorView, "= Changed");
    expect(await screen.findByLabelText("Unsaved changes")).toBeInTheDocument();
  });

  it("autosaves after the debounce window with the expected revision", async () => {
    const { getView } = renderPane();
    await screen.findByLabelText("Saved");

    typeIn(getView() as EditorView, "= Autosaved");
    await screen.findByLabelText("Unsaved changes");
    await flushAsync();

    await waitFor(() => {
      expect(saveSource).toHaveBeenCalledTimes(1);
    });
    expect(saveSource).toHaveBeenCalledWith("sid-1", "= Autosaved", "rev-1");
    await screen.findByLabelText("Saved");
  });

  it("does not mark dirty or autosave when the source loads (external reload)", async () => {
    renderPane();
    await screen.findByLabelText("Saved");
    await flushAsync();

    // Loading must not count as a user edit: no dirty state, no save call.
    expect(screen.queryByLabelText("Unsaved changes")).toBeNull();
    expect(saveSource).not.toHaveBeenCalled();
  });
});
