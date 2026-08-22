// Global keyboard shortcuts hook (work-plan Stage 16).
//
// Window-level keydown listener dispatching app actions:
//   Ctrl+O      open document (StartScreen / dialog)
//   Ctrl+S      save editor (only delivered when the editor is focused+dirty;
//               the editor itself decides — see TypstEditor Mod-s handling)
//   Ctrl+F      find — forwarded to CodeMirror's built-in search when the
//               editor is focused, otherwise ignored
//   Ctrl+=      preview zoom in
//   Ctrl+-      preview zoom out
//   Ctrl+0      preview reset / page-width
//   Ctrl+\      toggle editor (unless in conflict)
//
// The hook stays declarative: it receives callbacks and wires the listener.

import { useEffect } from "react";
import { dispatchShortcut, SHORTCUT_EVENTS } from "./shortcut-events";

export interface ShortcutHandlers {
  onOpen: () => void;
  onToggleEditor: () => void;
}

export function useGlobalShortcuts({ onOpen, onToggleEditor }: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();

      switch (key) {
        case "o":
          e.preventDefault();
          onOpen();
          return;
        case "s":
          // Always allow Ctrl+S: the editor's CodeMirror handler intercepts it
          // when the editor is focused, so this only reaches here when the
          // editor is NOT focused. No save action in that case.
          return;
        case "f":
          // Find is surface-dependent; if the editor is focused CodeMirror
          // handles it. Nothing to do globally.
          return;
        case "=":
        case "+":
          e.preventDefault();
          dispatchShortcut(SHORTCUT_EVENTS.ZOOM_IN);
          return;
        case "-":
        case "_":
          e.preventDefault();
          dispatchShortcut(SHORTCUT_EVENTS.ZOOM_OUT);
          return;
        case "0":
          e.preventDefault();
          dispatchShortcut(SHORTCUT_EVENTS.ZOOM_RESET);
          return;
        case "\\":
          e.preventDefault();
          onToggleEditor();
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen, onToggleEditor]);
}
