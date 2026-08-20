import { describe, expect, it } from "vitest";
import {
  clampPage,
  computeRelativeOffset,
  scrollTopForPage,
  zoomIn,
  zoomOut,
  resetZoom,
} from "@/preview/view-state";

describe("computeRelativeOffset", () => {
  it("returns 0 when scrollTop equals page top", () => {
    expect(computeRelativeOffset(100, 100, 500)).toBe(0);
  });

  it("returns 1 when scrolled to the page bottom", () => {
    expect(computeRelativeOffset(600, 100, 500)).toBe(1);
  });

  it("clamps scroll overscroll into 0..1", () => {
    expect(computeRelativeOffset(0, 100, 500)).toBe(0);
    expect(computeRelativeOffset(1000, 100, 500)).toBe(1);
  });

  it("guards against a zero-height page", () => {
    expect(computeRelativeOffset(100, 100, 0)).toBe(0);
  });
});

describe("clampPage", () => {
  it("clamps into [1, pageCount]", () => {
    expect(clampPage(0, 12)).toBe(1);
    expect(clampPage(7, 12)).toBe(7);
    expect(clampPage(99, 12)).toBe(12);
  });

  it("rounds fractional targets", () => {
    expect(clampPage(3.6, 12)).toBe(4);
  });

  it("clamps to at least 1 page", () => {
    expect(clampPage(5, 0)).toBe(1);
  });
});

describe("scrollTopForPage", () => {
  it("maps an offset to an absolute scroll position", () => {
    const tops = [0, 1000, 2000];
    const heights = [1000, 1000, 1000];
    expect(scrollTopForPage(1, 0, tops, heights)).toBe(0);
    expect(scrollTopForPage(1, 1, tops, heights)).toBe(1000);
    expect(scrollTopForPage(2, 0.5, tops, heights)).toBe(1500);
  });

  it("clamps out-of-range pages and offsets", () => {
    const tops = [0, 1000];
    const heights = [1000, 1000];
    expect(scrollTopForPage(99, 0, tops, heights)).toBe(1000);
    expect(scrollTopForPage(1, 2, tops, heights)).toBe(1000);
  });
});

describe("zoom helpers", () => {
  it("zooms in/out as fixed scale, reset returns to page-width", () => {
    const base = { scaleMode: "page-width" as const, scaleValue: 1, visiblePage: 1, relativeOffset: 0 };
    const z = zoomIn(base);
    expect(z.scaleMode).toBe("fixed");
    expect(z.scaleValue).toBeCloseTo(1.2);
    expect(zoomOut(z).scaleValue).toBeCloseTo(1);
    expect(resetZoom(z).scaleMode).toBe("page-width");
  });

  it("clamps zoom bounds", () => {
    const base = { scaleMode: "fixed" as const, scaleValue: 5, visiblePage: 1, relativeOffset: 0 };
    expect(zoomIn(base).scaleValue).toBe(5);
    const tiny = { ...base, scaleValue: 0.1 };
    expect(zoomOut(tiny).scaleValue).toBe(0.1);
  });
});
