// Preview view state (architecture §14.1): zoom/visibility, framework-agnostic.

export type ScaleMode = "page-width" | "fixed";

export interface ViewState {
  scaleMode: ScaleMode;
  scaleValue: number;
  visiblePage: number;
  relativeOffset: number;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  scaleMode: "page-width",
  scaleValue: 1,
  visiblePage: 1,
  relativeOffset: 0,
};

export function zoomIn(state: ViewState, step = 0.2): ViewState {
  return {
    ...state,
    scaleMode: "fixed",
    scaleValue: clamp(state.scaleValue + step),
  };
}

export function zoomOut(state: ViewState, step = 0.2): ViewState {
  return {
    ...state,
    scaleMode: "fixed",
    scaleValue: clamp(state.scaleValue - step),
  };
}

export function resetZoom(state: ViewState): ViewState {
  return { ...state, scaleMode: "page-width", scaleValue: 1 };
}

function clamp(v: number): number {
  return Math.min(5, Math.max(0.1, Math.round(v * 100) / 100));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/// Clamps a target page number into `[1, pageCount]` (architecture §14.1:
/// pagination may shrink after a live refresh).
export function clampPage(target: number, pageCount: number): number {
  const count = Math.max(1, Math.floor(pageCount));
  return Math.min(count, Math.max(1, Math.round(target)));
}

/// Fraction (0..1) of the scroll position inside a page: 0 = page top,
/// 1 = page bottom. Clamped so scroll overscroll never exceeds the range.
export function computeRelativeOffset(scrollTop: number, pageTop: number, pageHeight: number): number {
  if (pageHeight <= 0) return 0;
  return clamp01((scrollTop - pageTop) / pageHeight);
}

/// Absolute `scrollTop` that places `offset` (0..1) inside `page` (1-based),
/// used to restore the viewport after a new PDF loads (architecture §14.1).
export function scrollTopForPage(
  page: number,
  offset: number,
  pageTops: number[],
  pageHeights: number[],
): number {
  const idx = Math.max(0, Math.min(pageTops.length - 1, page - 1));
  const top = pageTops[idx] ?? 0;
  const height = pageHeights[idx] ?? 0;
  return Math.max(0, top + clamp01(offset) * height);
}
