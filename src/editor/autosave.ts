// Autosave debounce (architecture §15.2): a burst of keystrokes coalesces into
// a single save within a short window. Pure, framework-agnostic.

/** Default debounce window in ms (200–300 ms per the work plan). */
export const AUTOSAVE_DELAY_MS = 250;

export interface DebouncedSaver<T> {
  /** Schedules a save; resets the timer if called again within the window. */
  schedule(value: T): void;
  /** Fires immediately, cancelling any pending debounce. */
  flush(): void;
  /** Cancels a pending save without firing. */
  cancel(): void;
}

/**
 * Coalesces `schedule` calls so only the trailing value is delivered after the
 * window elapses. `flush()` delivers immediately (used by Ctrl+S).
 */
export function createDebouncedSaver<T>(
  deliver: (value: T) => void,
  delayMs: number = AUTOSAVE_DELAY_MS,
): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const fire = () => {
    clear();
    if (pending !== null) {
      const value = pending;
      pending = null;
      deliver(value);
    }
  };

  return {
    schedule(value) {
      pending = value;
      clear();
      timer = setTimeout(fire, delayMs);
    },
    flush() {
      fire();
    },
    cancel() {
      clear();
      pending = null;
    },
  };
}
