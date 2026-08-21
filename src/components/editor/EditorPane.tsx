// Editor pane: loads the active session source into CodeMirror, tracks
// dirty/saving state, and debounced-autosaves through the narrow backend
// `save_source` command (§15.2).

import { useCallback, useEffect, useRef, useState } from "react";
import { readSource, saveSource } from "@/bridge/commands";
import { TypstEditor } from "./TypstEditor";
import { SaveStatus } from "./SaveStatus";
import { createDebouncedSaver } from "@/editor/autosave";
import {
  INITIAL_EDITOR_STATE,
  markDirty,
  markLoaded,
  markSaved,
  markSaving,
  statusOf,
  type EditorState,
} from "@/editor/editor-state";

export function EditorPane({ sessionId, onViewReady }: { sessionId?: string; onViewReady?: (v: unknown) => void }) {
  const [editorState, setEditorState] = useState<EditorState>(INITIAL_EDITOR_STATE);
  const [externalValue, setExternalValue] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bufferRef = useRef("");
  const saveRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const editorStateRef = useRef(editorState);
  editorStateRef.current = editorState;
  const saverRef = useRef<{ schedule: (content: string) => void; flush: () => void; cancel: () => void } | null>(null);

  // Debounced autosave delivers the current buffer content.
  useEffect(() => {
    const saver = createDebouncedSaver(() => {
      const id = sessionIdRef.current;
      const state = editorStateRef.current;
      if (!id) return;
      if (!state.dirty || state.lastDiskRevision === null) return;
      const content = bufferRef.current;
      const expected = state.lastDiskRevision;
      setEditorState(markSaving);
      void saveSource(id, content, expected)
        .then((result) => {
          setEditorState((prev) => markSaved(prev, content, result.diskRevision));
        })
        .catch((e) => {
          // Conflict or I/O error: surface it, do not auto-resolve (§16).
          setLoadError(e instanceof Error ? e.message : String(e));
          setEditorState((prev) => ({ ...prev, saving: false }));
        });
    });
    saverRef.current = saver;
    saveRef.current = () => saver.flush();
    return () => saver.cancel();
  }, []);

  // Load the source when the session opens/changes.
  useEffect(() => {
    const id = sessionIdRef.current;
    if (!id) return;
    let cancelled = false;
    setLoadError(null);
    void readSource(id)
      .then((snapshot) => {
        if (cancelled) return;
        bufferRef.current = snapshot.content;
        setEditorState((s) => markLoaded(s, snapshot.content, snapshot.diskRevision));
        setExternalValue(snapshot.content);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const onBufferChange = useCallback((content: string) => {
    bufferRef.current = content;
    setEditorState((s) => markDirty(s));
    // Schedule a debounced autosave for this buffer change (§15.2).
    saverRef.current?.schedule(content);
  }, []);

  const onSaveNow = useCallback(() => {
    saveRef.current?.();
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex h-8 items-center gap-2 border-b border-border px-2">
        <SaveStatus status={statusOf(editorState)} />
        {loadError ? (
          <span className="truncate text-xs text-destructive" role="alert">
            {loadError}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        {sessionId ? (
          <TypstEditor
            value={bufferRef.current}
            onChange={onBufferChange}
            onSave={onSaveNow}
            externalValue={externalValue}
            onViewReady={onViewReady}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No document open.
          </div>
        )}
      </div>
    </div>
  );
}

