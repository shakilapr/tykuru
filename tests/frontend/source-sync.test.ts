import { describe, expect, it } from "vitest";
import {
  INITIAL_SYNC_STATE,
  onCleanReload,
  onExternalChange,
  onKeepLocalResult,
  onLocalChange,
  onReloadExternal,
  onSaved,
  onSaveStart,
} from "@/editor/source-sync";

describe("source-sync state machine", () => {
  it("starts clean; a local edit makes it dirty", () => {
    expect(INITIAL_SYNC_STATE.state).toBe("clean");
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    expect(dirty.state).toBe("dirty");
  });

  it("external change while not dirty stays clean (silent reload)", () => {
    const after = onExternalChange(INITIAL_SYNC_STATE, "rev-B", false);
    expect(after.state).toBe("clean");
    expect(after.conflict).toBeNull();
  });

  it("external change while dirty enters conflict with the external revision", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const conflict = onExternalChange(dirty, "rev-B", true);
    expect(conflict.state).toBe("conflict");
    expect(conflict.conflict?.externalRevision).toBe("rev-B");
    expect(conflict.conflictChangedAgain).toBe(false);
  });

  it("external change while clean-but-dirty-flag-set enters conflict (batching guard)", () => {
    // Even if the state machine is still "clean" because React batched the
    // local edit, the isDirty flag from the editor ref forces Conflict.
    const conflict = onExternalChange(INITIAL_SYNC_STATE, "rev-B", true);
    expect(conflict.state).toBe("conflict");
    expect(conflict.conflict?.externalRevision).toBe("rev-B");
  });

  it("no automatic write during conflict: keep-local result drives transition", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const conflict = onExternalChange(dirty, "rev-B", true);
    // Successful keep-local → clean.
    const clean = onKeepLocalResult(conflict, true, "rev-B");
    expect(clean.state).toBe("clean");
  });

  it("rejected keep-local against a newer revision refreshes the snapshot (B → C)", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const conflict = onExternalChange(dirty, "rev-B", true);
    const rejected = onKeepLocalResult(conflict, false, "rev-C");
    expect(rejected.state).toBe("conflict");
    expect(rejected.conflict?.externalRevision).toBe("rev-C");
    expect(rejected.conflictChangedAgain).toBe(true);
  });

  it("another external change while in conflict refreshes to the newest revision", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const c1 = onExternalChange(dirty, "rev-B", true);
    const c2 = onExternalChange(c1, "rev-C", true);
    expect(c2.state).toBe("conflict");
    expect(c2.conflict?.externalRevision).toBe("rev-C");
    expect(c2.conflictChangedAgain).toBe(true);
  });

  it("reload external returns to clean and clears the conflict", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const conflict = onExternalChange(dirty, "rev-B", true);
    const clean = onReloadExternal(conflict);
    expect(clean.state).toBe("clean");
    expect(clean.conflict).toBeNull();
  });

  it("save transitions: start → saving, success → clean", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const saving = onSaveStart(dirty);
    expect(saving.state).toBe("saving");
    const clean = onSaved(saving);
    expect(clean.state).toBe("clean");
  });

  it("save start is a no-op during conflict", () => {
    const dirty = onLocalChange(INITIAL_SYNC_STATE);
    const conflict = onExternalChange(dirty, "rev-B", true);
    expect(onSaveStart(conflict).state).toBe("conflict");
  });

  it("cleanReload returns to clean", () => {
    const after = onCleanReload(INITIAL_SYNC_STATE);
    expect(after.state).toBe("clean");
  });
});
