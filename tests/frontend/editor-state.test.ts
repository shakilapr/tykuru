import { describe, expect, it } from "vitest";
import {
  INITIAL_EDITOR_STATE,
  markDirty,
  markLoaded,
  markSaved,
  markSaving,
  statusOf,
} from "@/editor/editor-state";

describe("editor-state", () => {
  it("starts saved and not dirty", () => {
    expect(statusOf(INITIAL_EDITOR_STATE)).toBe("saved");
    expect(INITIAL_EDITOR_STATE.dirty).toBe(false);
  });

  it("typing marks dirty", () => {
    const state = markLoaded(INITIAL_EDITOR_STATE, "hello", "rev-1");
    expect(statusOf(state)).toBe("saved");
    const dirty = markDirty(state);
    expect(dirty.dirty).toBe(true);
    expect(statusOf(dirty)).toBe("dirty");
  });

  it("markSaving takes precedence as saving", () => {
    const state = markSaving(markDirty(markLoaded(INITIAL_EDITOR_STATE, "hello", "rev-1")));
    expect(statusOf(state)).toBe("saving");
  });

  it("markSaved clears dirty and advances revision", () => {
    const loaded = markLoaded(INITIAL_EDITOR_STATE, "hello", "rev-1");
    const dirty = markDirty(loaded);
    const saved = markSaved(dirty, "hello!", "rev-2");
    expect(statusOf(saved)).toBe("saved");
    expect(saved.lastDiskRevision).toBe("rev-2");
    expect(saved.lastSavedContent).toBe("hello!");
  });
});
