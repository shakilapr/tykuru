// Pure revision-identity guards for preview events (architecture §12.2, §13).
// No I/O, no React — unit-testable without a DOM.

export interface PreviewEvent {
  sessionId: string;
  revision: number;
}

export interface DisplayedState {
  sessionId: string | null;
  revision: number | null;
}

/// True when the incoming event belongs to the currently displayed session.
export function isSameSession(active: DisplayedState, event: PreviewEvent): boolean {
  return active.sessionId !== null && active.sessionId === event.sessionId;
}

/// True when `incoming` is strictly newer than `current` (per session) so an
/// older/stale preview must not replace a newer one.
export function isNewerRevision(current: DisplayedState, incoming: PreviewEvent): boolean {
  if (current.sessionId === null) return true;
  if (current.sessionId !== incoming.sessionId) return true; // switched session
  if (current.revision === null) return true;
  return incoming.revision > current.revision;
}
