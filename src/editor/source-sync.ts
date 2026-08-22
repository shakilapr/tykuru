// Source-sync state machine (architecture §16). Pure and framework-agnostic.
//
// Tracks whether the editor buffer can be safely re-synced from disk (Clean) or
// holds unsaved local edits that must not be clobbered (Dirty → Conflict).
//
// Conflict snapshot: { baseRevision, localBuffer, externalRevision }. When a
// "Keep my version" write is rejected because disk moved again (B → C), the
// snapshot is refreshed to the newest external revision (§16.4/§16.5).

export type SyncState = "clean" | "dirty" | "saving" | "conflict";

export interface ConflictSnapshot {
  /** Disk revision the buffer was loaded from (before local edits). */
  baseRevision: string;
  /** The unsaved local buffer. */
  localBuffer: string;
  /** The external disk revision the conflict was detected against. */
  externalRevision: string;
}

export interface SourceSyncState {
  state: SyncState;
  conflict: ConflictSnapshot | null;
  /** Set when a Keep-local attempt fails against a newer external revision. */
  conflictChangedAgain: boolean;
}

export const INITIAL_SYNC_STATE: SourceSyncState = {
  state: "clean",
  conflict: null,
  conflictChangedAgain: false,
};

/** A local edit occurred; a clean editor becomes dirty. */
export function onLocalChange(s: SourceSyncState): SourceSyncState {
  if (s.state !== "clean") return s;
  return { ...s, state: "dirty" };
}

/**
 * An external disk change arrived (source-changed event).
 * `isDirty` is the editor's actual unsaved state at event time (read via a ref,
 * so React batching of a just-fired local edit cannot hide it).
 * - Not dirty → stays Clean; the caller reloads the buffer from disk (silent).
 * - Dirty → Conflict; autosave is suspended, no automatic write.
 * - Already Conflict → refresh the snapshot's external revision to the newest.
 */
export function onExternalChange(
  s: SourceSyncState,
  externalRevision: string,
  isDirty: boolean,
): SourceSyncState {
  if (s.state === "conflict") {
    // Disk moved again while we were already in conflict (B → C).
    return {
      state: "conflict",
      conflict: {
        baseRevision: s.conflict?.baseRevision ?? "",
        localBuffer: s.conflict?.localBuffer ?? "",
        externalRevision,
      },
      conflictChangedAgain: true,
    };
  }
  if (!isDirty) {
    // Silent reload path; state stays clean. The caller re-reads disk.
    return { ...s, state: "clean", conflict: null, conflictChangedAgain: false };
  }
  return {
    state: "conflict",
    conflict: {
      baseRevision: s.conflict?.baseRevision ?? "",
      localBuffer: s.conflict?.localBuffer ?? "",
      externalRevision,
    },
    conflictChangedAgain: false,
  };
}

/** The caller re-read the disk content for a clean external change. */
export function onCleanReload(s: SourceSyncState): SourceSyncState {
  return { ...s, state: "clean", conflict: null, conflictChangedAgain: false };
}

/** A save transaction started (transient sub-state of Dirty/Clean). */
export function onSaveStart(s: SourceSyncState): SourceSyncState {
  if (s.state === "conflict") return s;
  return { ...s, state: "saving" };
}

/** A save succeeded. */
export function onSaved(s: SourceSyncState): SourceSyncState {
  return { ...s, state: "clean", conflict: null, conflictChangedAgain: false };
}

/** User chose "Reload external": discard local buffer, load disk. */
export function onReloadExternal(s: SourceSyncState): SourceSyncState {
  return { ...s, state: "clean", conflict: null, conflictChangedAgain: false };
}

/**
 * User chose "Keep my version": the caller attempts the revision-checked write.
 * On success returns `onSaved`; on rejection (disk moved B → C) the snapshot is
 * refreshed to the newest external revision and the conflict stays.
 */
export function onKeepLocalAttempt(s: SourceSyncState): SourceSyncState {
  return s; // write in flight; resolved by onKeepLocalResult
}

export function onKeepLocalResult(
  s: SourceSyncState,
  ok: boolean,
  newestExternalRevision: string,
): SourceSyncState {
  if (ok) return onSaved(s);
  // Rejected: disk moved to a newer revision. Refresh snapshot, stay in Conflict.
  return {
    state: "conflict",
    conflict: {
      baseRevision: s.conflict?.baseRevision ?? "",
      localBuffer: s.conflict?.localBuffer ?? "",
      externalRevision: newestExternalRevision,
    },
    conflictChangedAgain: true,
  };
}
