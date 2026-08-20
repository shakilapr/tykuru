import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useAppState } from "@/app/app-state";
import { StartScreen } from "@/components/StartScreen";

function DocumentProbe() {
  const { documentState, openDocumentState, openingDocumentState, errorDocumentState, resetDocumentState } =
    useAppState();
  return (
    <div>
      <span data-testid="kind">{documentState.kind}</span>
      <button onClick={() => openingDocumentState("main.typ")}>opening</button>
      <button onClick={() => openDocumentState("sid", "main.typ")}>open</button>
      <button onClick={() => errorDocumentState("boom")}>error</button>
      <button onClick={() => resetDocumentState()}>reset</button>
    </div>
  );
}

describe("DocumentUiState", () => {
  it("transitions through the state machine", () => {
    render(
      <ThemeProvider>
        <DocumentProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("kind").textContent).toBe("empty");
    fireEvent.click(screen.getByText("opening"));
    expect(screen.getByTestId("kind").textContent).toBe("opening");
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("kind").textContent).toBe("open");
    fireEvent.click(screen.getByText("error"));
    expect(screen.getByTestId("kind").textContent).toBe("error");
    fireEvent.click(screen.getByText("reset"));
    expect(screen.getByTestId("kind").textContent).toBe("empty");
  });
});

describe("StartScreen error banner", () => {
  it("renders an error alert when error is provided", () => {
    render(<StartScreen onOpen={() => {}} onOpenPath={() => {}} error="cannot open file" />);
    expect(screen.getByRole("alert")).toHaveTextContent("cannot open file");
  });

  it("does not render an alert when there is no error", () => {
    render(<StartScreen onOpen={() => {}} onOpenPath={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
