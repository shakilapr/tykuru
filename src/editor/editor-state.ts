// Editor save-state model (architecture §15): pure, framework-agnostic.
//
// Tracks whether the editor buffer differs from the last-known disk snapshot
// and the expected disk revision used for the save transaction (§15.2).

export type SaveStatus = "saved" | "saving" | "dirty";

export interface EditorState {
  /** True while a save transaction is in flight. */
  saving: boolean;
  /** True when the buffer differs from the last-known disk content. */
  dirty: boolean;
  /** Disk revision (content hash) the editor last loaded or saved. */
  lastDiskRevision: string | null;
  /** Content last known to be on disk (used to detect "saved" vs "dirty"). */
  lastSavedContent: string | null;
}

export const INITIAL_EDITOR_STATE: EditorState = {
  saving: false,
  dirty: false,
  lastDiskRevision: null,
  lastSavedContent: null,
};

export function statusOf(state: EditorState): SaveStatus {
  if (state.saving) return "saving";
  if (state.dirty) return "dirty";
  return "saved";
}

/// Marks the editor as loaded: buffer equals disk content, not dirty.
export function markLoaded(state: EditorState, content: string, diskRevision: string): EditorState {
  return {
    ...state,
    saving: false,
    dirty: false,
    lastDiskRevision: diskRevision,
    lastSavedContent: content,
  };
}

/// The user typed; the buffer now differs from disk.
export function markDirty(state: EditorState): EditorState {
  return { ...state, dirty: true };
}

/// A save transaction started.
export function markSaving(state: EditorState): EditorState {
  return { ...state, saving: true };
}

/// A save completed; buffer matches disk, revision advanced.
export function markSaved(state: EditorState, content: string, diskRevision: string): EditorState {
  return {
    ...state,
    saving: false,
    dirty: false,
    lastDiskRevision: diskRevision,
    lastSavedContent: content,
  };
}
