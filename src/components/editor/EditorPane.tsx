// Editor pane: loads the active session source into CodeMirror, tracks
// dirty/saving state, debounced-autosaves through the narrow backend
// `save_source` command (§15.2), and reconciles external edits (§16).

import { useCallback, useEffect, useRef, useState } from "react";
import { readSource, saveSource } from "@/bridge/commands";
import { TypstEditor } from "./TypstEditor";
import { SaveStatus } from "./SaveStatus";
import { ConflictBanner } from "./ConflictBanner";
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
import { useSourceSync } from "@/editor/use-source-sync";

export function EditorPane({
  sessionId,
  onViewReady,
}: {
  sessionId?: string;
  onViewReady?: (v: unknown) => void;
}) {
  const [editorState, setEditorState] = useState<EditorState>(INITIAL_EDITOR_STATE);
  const [externalValue, setExternalValue] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bufferRef = useRef("");
  const saveRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const editorStateRef = useRef(editorState);
  editorStateRef.current = editorState;
  // Synchronous dirty flag: updated on every buffer change so the source-sync
  // event handler can decide Clean-reload vs Conflict without waiting for a
  // React render (CodeMirror defers its updateListener; the buffer ref is
  // synchronous). Compared against the last-saved content, which is also
  // tracked in a ref.
  const dirtyRef = useRef(false);
  const lastSavedContentRef = useRef<string | null>(null);
  const saverRef = useRef<{ schedule: (content: string) => void; flush: () => void; cancel: () => void } | null>(null);

  const getIsDirty = useCallback(
    () =>
      dirtyRef.current ||
      editorStateRef.current.dirty ||
      (lastSavedContentRef.current !== null && bufferRef.current !== lastSavedContentRef.current),
    [],
  );
  // Re-read disk and replace the buffer. Used for the clean silent reload path
  // triggered by a `source-changed` event (§16.3).
  const applyDiskContent = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return;
    try {
      const snapshot = await readSource(id);
      bufferRef.current = snapshot.content;
      dirtyRef.current = false;
      lastSavedContentRef.current = snapshot.content;
      setEditorState((s) => markLoaded(s, snapshot.content, snapshot.disk_revision));
      setExternalValue(snapshot.content);
      syncRef.current.cleanReload();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const sync = useSourceSync(sessionId, getIsDirty, () => {
    void applyDiskContent();
  });
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const syncStateRef = useRef(sync.syncState);
  syncStateRef.current = sync.syncState;

  // Debounced autosave delivers the current buffer content. Suspended while the
  // editor is in Conflict (§16.4). Uses refs so it never re-runs when syncState
  // changes (which would reset the debounce timer).
  useEffect(() => {
    const saver = createDebouncedSaver(() => {
      const id = sessionIdRef.current;
      const state = editorStateRef.current;
      const syncState = syncStateRef.current;
      if (!id) return;
      if (syncState.state === "conflict") return;
      if (!state.dirty || state.lastDiskRevision === null) return;
      const content = bufferRef.current;
      const expected = state.lastDiskRevision;
      setEditorState(markSaving);
      syncRef.current.saveStart();
      void saveSource(id, content, expected)
        .then((result) => {
          dirtyRef.current = false;
          lastSavedContentRef.current = content;
          setEditorState((prev) => markSaved(prev, content, result.disk_revision));
          syncRef.current.saved();
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
    // Mounted once; reads sync via refs so syncState changes do not reset the timer.
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
        dirtyRef.current = false;
        lastSavedContentRef.current = snapshot.content;
        setEditorState((s) => markLoaded(s, snapshot.content, snapshot.disk_revision));
        setExternalValue(snapshot.content);
        syncRef.current.cleanReload();
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // Reloads when the session changes; sync is read via ref.
  }, [sessionId]);

  const onBufferChange = useCallback(
    (content: string) => {
      bufferRef.current = content;
      dirtyRef.current = true;
      setEditorState((s) => markDirty(s));
      sync.localEdit();
      // Schedule a debounced autosave for this buffer change (§15.2), unless
      // we are in Conflict.
      if (syncStateRef.current.state !== "conflict") {
        saverRef.current?.schedule(content);
      }
    },
    [sync],
  );

  const onSaveNow = useCallback(() => {
    saveRef.current?.();
  }, []);

  const onReloadExternal = useCallback(() => {
    void applyDiskContent();
    sync.reloadExternal();
  }, [applyDiskContent, sync]);

  const onKeepMyVersion = useCallback(async () => {
    const content = bufferRef.current;
    const ok = await sync.keepMyVersion(content);
    if (ok) {
      // The write succeeded; treat it as a normal save completion.
      const id = sessionIdRef.current;
      if (!id) return;
      try {
        const snapshot = await readSource(id);
        dirtyRef.current = false;
        lastSavedContentRef.current = content;
        setEditorState((s) => markSaved(s, content, snapshot.disk_revision));
        sync.saved();
      } catch {
        /* leave state as-is */
      }
    } else {
      // Rejected: disk moved again (B → C). Re-read to refresh the conflict
      // snapshot to the newest revision and surface "file changed again".
      const id = sessionIdRef.current;
      if (!id) return;
      try {
        const snapshot = await readSource(id);
        sync.refreshConflict(snapshot.disk_revision);
      } catch {
        /* leave state as-is */
      }
    }
  }, [sync]);

  const inConflict = sync.syncState.state === "conflict";
  const status = inConflict ? "conflict" : statusOf(editorState);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex h-8 items-center gap-2 border-b border-border px-2">
        <SaveStatus status={status} />
        {loadError ? (
          <span className="truncate text-xs text-destructive" role="alert">
            {loadError}
          </span>
        ) : null}
      </div>
      {inConflict ? (
        <ConflictBanner
          changedAgain={sync.syncState.conflictChangedAgain}
          onReloadExternal={onReloadExternal}
          onKeepMyVersion={() => void onKeepMyVersion()}
        />
      ) : null}
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
