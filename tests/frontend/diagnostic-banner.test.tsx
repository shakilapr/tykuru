import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiagnosticBanner } from "@/components/preview/DiagnosticBanner";

describe("DiagnosticBanner", () => {
  it("renders nothing when status is not error", () => {
    const { container } = render(<DiagnosticBanner state={{ status: "ready", revision: 2 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the diagnostic message in error state", () => {
    render(<DiagnosticBanner state={{ status: "error", message: "missing brace", lastGoodRevision: 2 }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("missing brace");
  });

  it("shows a safe fallback when message is absent", () => {
    render(<DiagnosticBanner state={{ status: "error" }} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
