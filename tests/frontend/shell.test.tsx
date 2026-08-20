import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, clampSplitRatio, useAppState } from "@/app/app-state";
import { StartScreen } from "@/components/StartScreen";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { ResizablePanels } from "@/components/ui/resizable";

const renderWithTheme = (ui: React.ReactNode) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe("StartScreen", () => {
  it("renders Open button with accessible name", () => {
    render(<StartScreen onOpen={() => {}} onOpenPath={() => {}} />);
    expect(screen.getByRole("button", { name: "Open .typ" })).toBeInTheDocument();
  });
});

describe("clampSplitRatio", () => {
  it("clamps to [0.2, 0.8]", () => {
    expect(clampSplitRatio(0.05)).toBe(0.2);
    expect(clampSplitRatio(0.95)).toBe(0.8);
    expect(clampSplitRatio(0.5)).toBe(0.5);
    expect(clampSplitRatio(NaN)).toBe(0.5);
  });
});

describe("Toolbar", () => {
  it("disables zoom buttons when no preview is active", () => {
    renderWithTheme(<Toolbar onOpen={() => {}} previewActive={false} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });

  it("enables zoom buttons when preview is active", () => {
    renderWithTheme(<Toolbar onOpen={() => {}} previewActive />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
  });

  it("every icon-only button has an aria-label", () => {
    renderWithTheme(<Toolbar onOpen={() => {}} previewActive />);
    for (const name of ["Open .typ", "Toggle editor", "Zoom out", "Zoom in", "More"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

describe("ResizablePanels", () => {
  it("hides editor pane when editorVisible is false (preview expanded)", () => {
    render(
      <ResizablePanels editorVisible={false} editorRatio={0.5} editor={<div>ED</div>} preview={<div>PV</div>} />,
    );
    const preview = screen.getByLabelText("Preview pane");
    expect(preview).toHaveAttribute("data-state", "preview-expanded");
    expect(screen.queryByLabelText("Editor pane")).toBeNull();
  });

  it("shows editor pane when editorVisible is true", () => {
    render(
      <ResizablePanels editorVisible editorRatio={0.5} editor={<div>ED</div>} preview={<div>PV</div>} />,
    );
    expect(screen.getByLabelText("Editor pane")).toBeInTheDocument();
  });
});

describe("ThemeProvider", () => {
  it("sets documentElement class to dark for dark preference", () => {
    function Probe() {
      const { setTheme } = useAppState();
      return <button onClick={() => setTheme("dark")}>set</button>;
    }
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("set"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes dark class for light preference", () => {
    document.documentElement.classList.add("dark");
    function Probe() {
      const { setTheme } = useAppState();
      return <button onClick={() => setTheme("light")}>set</button>;
    }
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("set"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
