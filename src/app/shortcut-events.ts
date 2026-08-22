// Cross-cutting UI events for keyboard shortcuts (architecture §16 polish).
//
// Some shortcuts target components that are not direct ancestors of the
// shortcut listener (the editor pane for Ctrl+S, the preview pane for zoom).
// We use named `CustomEvent`s dispatched on `window` so the toolbar buttons
// and the global shortcuts share one delivery path.

export const SHORTCUT_EVENTS = {
  SAVE_EDITOR: "tykuru:shortcut-save",
  ZOOM_IN: "tykuru:shortcut-zoom-in",
  ZOOM_OUT: "tykuru:shortcut-zoom-out",
  ZOOM_RESET: "tykuru:shortcut-zoom-reset",
} as const;

export type ShortcutEventName = (typeof SHORTCUT_EVENTS)[keyof typeof SHORTCUT_EVENTS];

export function dispatchShortcut(name: ShortcutEventName): void {
  window.dispatchEvent(new CustomEvent(name));
}
