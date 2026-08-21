import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createDebouncedSaver,
  AUTOSAVE_DELAY_MS,
} from "@/editor/autosave";

describe("createDebouncedSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends one save for a burst of keystrokes within the window", () => {
    const deliver = vi.fn();
    const saver = createDebouncedSaver(deliver, AUTOSAVE_DELAY_MS);
    saver.schedule("a");
    saver.schedule("ab");
    saver.schedule("abc");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith("abc");
  });

  it("continued typing resets the timer", () => {
    const deliver = vi.fn();
    const saver = createDebouncedSaver(deliver, AUTOSAVE_DELAY_MS);
    saver.schedule("a");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 10);
    saver.schedule("ab"); // resets
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 10);
    expect(deliver).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith("ab");
  });

  it("flush delivers immediately and cancels pending debounce", () => {
    const deliver = vi.fn();
    const saver = createDebouncedSaver(deliver, AUTOSAVE_DELAY_MS);
    saver.schedule("a");
    saver.flush();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith("a");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(deliver).toHaveBeenCalledTimes(1); // no duplicate
  });

  it("cancel drops the pending value without firing", () => {
    const deliver = vi.fn();
    const saver = createDebouncedSaver(deliver, AUTOSAVE_DELAY_MS);
    saver.schedule("a");
    saver.cancel();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(deliver).not.toHaveBeenCalled();
  });
});
