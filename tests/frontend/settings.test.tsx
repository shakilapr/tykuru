import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, useAppState, clampSplitRatio } from "@/app/app-state";

const getSettings = vi.fn();
const updateSettings = vi.fn();

vi.mock("@/bridge/settings", () => ({
  getSettings: (...a: unknown[]) => getSettings(...a),
  updateSettings: (...a: unknown[]) => updateSettings(...a),
}));

function Probe() {
  const { theme, setTheme, editorVisible, toggleEditor, splitRatio, setSplitRatio, settingsLoaded } =
    useAppState();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="editor-visible">{String(editorVisible)}</span>
      <span data-testid="split-ratio">{splitRatio}</span>
      <span data-testid="settings-loaded">{String(settingsLoaded)}</span>
      <button onClick={() => setTheme("dark")}>set-dark</button>
      <button onClick={toggleEditor}>toggle-editor</button>
      <button onClick={() => setSplitRatio(0.7)}>set-ratio</button>
    </div>
  );
}

describe("settings persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getSettings.mockRejectedValue(new Error("no backend"));
    updateSettings.mockRejectedValue(new Error("no backend"));
  });

  it("loads persisted settings from the backend on mount", async () => {
    getSettings.mockResolvedValue({
      version: 1,
      theme: "dark",
      editor_visible: true,
      split_ratio: 0.6,
      recent_files: { files: [] },
      root_overrides: {},
      window_state: null,
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("settings-loaded").textContent).toBe("true"));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("editor-visible").textContent).toBe("true");
    expect(screen.getByTestId("split-ratio").textContent).toBe("0.6");
  });

  it("falls back to localStorage/defaults when the backend is unavailable", async () => {
    localStorage.setItem("tykuru.theme", "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("settings-loaded").textContent).toBe("true"));
    // localStorage fallback is applied only until the backend resolves (which
    // rejects here), so the stored value wins.
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("persists theme/editor/split changes to the backend", async () => {
    updateSettings.mockResolvedValue({
      version: 1,
      theme: "system",
      editor_visible: false,
      split_ratio: 0.5,
      recent_files: { files: [] },
      root_overrides: {},
      window_state: null,
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("set-dark"));
    fireEvent.click(screen.getByText("toggle-editor"));
    fireEvent.click(screen.getByText("set-ratio"));
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(3));
    expect(updateSettings).toHaveBeenCalledWith({ theme: "dark" });
    expect(updateSettings).toHaveBeenCalledWith({ editor_visible: true });
    expect(updateSettings).toHaveBeenCalledWith({ split_ratio: 0.7 });
  });

  it("applies the dark class to <html> for a dark theme", async () => {
    getSettings.mockResolvedValue({
      version: 1,
      theme: "dark",
      editor_visible: false,
      split_ratio: 0.5,
      recent_files: { files: [] },
      root_overrides: {},
      window_state: null,
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
  });
});

describe("clampSplitRatio", () => {
  it("bounds the ratio to the allowed window", () => {
    expect(clampSplitRatio(NaN)).toBe(0.5);
    expect(clampSplitRatio(0.1)).toBe(0.2);
    expect(clampSplitRatio(0.9)).toBe(0.8);
    expect(clampSplitRatio(0.5)).toBe(0.5);
  });
});
