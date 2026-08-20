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
