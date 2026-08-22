// Source-sync hook: subscribes to `source-changed` and drives the pure state
// machine (architecture §16). The EditorPane consumes the state to decide
// silent reload (clean) vs Conflict (dirty), and calls reloadExternal /
// keepMyVersion.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { SOURCE_CHANGED } from "@/bridge/events";
import { resolveSourceConflictKeepLocal } from "@/bridge/commands";
import {
  INITIAL_SYNC_STATE,
  onCleanReload,
  onExternalChange,
  onKeepLocalResult,
  onLocalChange,
  onReloadExternal,
  onSaved,
  onSaveStart,
  type SourceSyncState,
} from "@/editor/source-sync";

export interface SourceSyncController {
  syncState: SourceSyncState;
  /** Called by the editor on a local buffer edit. */
  localEdit: () => void;
  /** Called when the debounced autosave begins. */
  saveStart: () => void;
  /** Called when a save succeeds. */
  saved: () => void;
  /** Called after a clean reload re-read disk content successfully. */
  cleanReload: () => void;
  /** User chose "Reload external": discard local buffer, load disk. */
  reloadExternal: () => void;
  /** User chose "Keep my version": revision-checked write; rejects → refresh. */
  keepMyVersion: (content: string) => Promise<boolean>;
  /** Refreshes the conflict snapshot's external revision (disk moved B → C). */
  refreshConflict: (newestExternalRevision: string) => void;
}

export function useSourceSync(
  sessionId: string | undefined,
  getIsDirty: () => boolean,
  onExternalDiskChange: () => void,
): SourceSyncController {
  const [syncState, setSyncState] = useState<SourceSyncState>(INITIAL_SYNC_STATE);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const getIsDirtyRef = useRef(getIsDirty);
  getIsDirtyRef.current = getIsDirty;
  const onExternalDiskChangeRef = useRef(onExternalDiskChange);
  onExternalDiskChangeRef.current = onExternalDiskChange;

  const localEdit = useCallback(() => setSyncState((s) => onLocalChange(s)), []);
  const saveStart = useCallback(() => setSyncState((s) => onSaveStart(s)), []);
  const saved = useCallback(() => setSyncState((s) => onSaved(s)), []);
  const cleanReload = useCallback(() => setSyncState((s) => onCleanReload(s)), []);
  const reloadExternal = useCallback(() => setSyncState((s) => onReloadExternal(s)), []);

  const keepMyVersion = useCallback(
    async (content: string): Promise<boolean> => {
      const id = sessionIdRef.current;
      const snapshot = syncStateRef.current.conflict;
      if (!id || !snapshot) return false;
      try {
        await resolveSourceConflictKeepLocal(id, content, snapshot.externalRevision);
        setSyncState((s) => onKeepLocalResult(s, true, snapshot.externalRevision));
        return true;
      } catch {
        // Disk moved again (B → C). The caller re-reads disk to obtain the
        // newest revision and calls refreshConflict to stay in Conflict with
        // "file changed again" (§16.4).
        return false;
      }
    },
    [],
  );

  const refreshConflict = useCallback(
    (newestExternalRevision: string) => {
      setSyncState((s) => onKeepLocalResult(s, false, newestExternalRevision));
    },
    [],
  );

  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;

  useEffect(() => {
    const unlisten = listen<[string, string]>(SOURCE_CHANGED, (e) => {
      const [sid, revision] = e.payload;
      if (sid !== sessionIdRef.current) return; // stale session, §8.3
      const d = getIsDirtyRef.current();
      const next = onExternalChange(syncStateRef.current, revision, d);
      setSyncState(next);
      // Clean external change: the editor re-reads disk silently (§16.3).
      if (next.state === "clean" && !d) {
        onExternalDiskChangeRef.current();
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const controller = useMemo<SourceSyncController>(
    () => ({
      syncState,
      localEdit,
      saveStart,
      saved,
      cleanReload,
      reloadExternal,
      keepMyVersion,
      refreshConflict,
    }),
    [
      syncState,
      localEdit,
      saveStart,
      saved,
      cleanReload,
      reloadExternal,
      keepMyVersion,
      refreshConflict,
    ],
  );

  return controller;
}
