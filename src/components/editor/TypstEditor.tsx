// CodeMirror 6 Typst source editor (architecture §15). Syntax-only editing:
// no LSP, no WASM compiler, no alternative diagnostics authority.

import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching } from "@codemirror/language";

export interface TypstEditorProps {
  /** Initial source content. */
  value: string;
  /** Called when the buffer changes (for dirty tracking + debounced save). */
  onChange: (content: string) => void;
  /** Called when the user presses Ctrl+S (immediate save). */
  onSave: () => void;
  /** Replaces the buffer content (external reload / document switch). */
  externalValue: string | null;
  /** Disabled while a save or conflict resolution is in flight. */
  readOnly?: boolean;
  /** Test/advanced hook: receives the mounted EditorView. */
  onViewReady?: (view: EditorView) => void;
}

export function TypstEditor({
  value,
  onChange,
  onSave,
  externalValue,
  readOnly,
  onViewReady,
}: TypstEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const readOnlyCompartmentRef = useRef<Compartment | null>(null);
  const valueRef = useRef(value);

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  valueRef.current = value;

  // Mount the editor once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (viewRef.current) return;

    const readOnlyCompartment = new Compartment();
    readOnlyCompartmentRef.current = readOnlyCompartment;

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        closeBrackets(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              onSaveRef.current();
              return true;
            },
            preventDefault: true,
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        readOnlyCompartment.of(EditorView.editable.of(!readOnly)),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    onViewReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; value/externalValue handled below.
  }, []);

  // Apply external content (document switch / external reload) without losing
  // undo history where possible.
  useEffect(() => {
    if (externalValue === null) return;
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === externalValue) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: externalValue },
    });
  }, [externalValue]);

  // Apply read-only state changes.
  useEffect(() => {
    const view = viewRef.current;
    const compartment = readOnlyCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({
      effects: compartment.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  return <div ref={hostRef} className="h-full w-full overflow-auto" data-testid="typst-editor" />;
}
