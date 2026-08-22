//! Source-revision ledger and change classification (architecture §15.3, §16).
//!
//! Tykuru must not interpret its own write as an external edit, and must only
//! surface genuine external changes to the editor. This module holds the
//! per-session `{ disk_revision, last_self_write }` state and a pure classifier
//! so the watcher's decision is unit-testable without threads or filesystem.

use std::collections::HashMap;

use crate::session::SessionId;
use crate::source::write::DiskRevision;

/// How a re-read of the entry file relates to what Tykuru already knows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeKind {
    /// The on-disk revision equals our own last write (or the recorded disk
    /// revision) — not an external edit.
    SelfWrite,
    /// The on-disk revision matches the recorded disk revision — no change.
    Unchanged,
    /// The on-disk revision differs — a genuine external edit to surface.
    External,
}

/// Per-session source-revision state (transient; never persisted).
#[derive(Debug, Clone, Default)]
pub struct SourceRevisionState {
    pub disk_revision: DiskRevision,
    pub last_self_write: Option<DiskRevision>,
}

/// Ledger of source revisions keyed by `SessionId`, owned by `AppState`.
#[derive(Default)]
pub struct SourceRevisionRegistry {
    states: HashMap<SessionId, SourceRevisionState>,
}

impl SourceRevisionRegistry {
    pub fn state(&self, id: &SessionId) -> Option<&SourceRevisionState> {
        self.states.get(id)
    }

    pub fn state_mut(&mut self, id: &SessionId) -> &mut SourceRevisionState {
        self.states.entry(id.clone()).or_default()
    }

    pub fn note_disk_revision(&mut self, id: &SessionId, revision: DiskRevision) {
        self.state_mut(id).disk_revision = revision;
    }

    pub fn note_self_write(&mut self, id: &SessionId, revision: DiskRevision) {
        let s = self.state_mut(id);
        s.last_self_write = Some(revision.clone());
        s.disk_revision = revision;
    }

    pub fn remove(&mut self, id: &SessionId) -> Option<SourceRevisionState> {
        self.states.remove(id)
    }
}

/// Classifies a freshly read on-disk revision against the ledger.
///
/// Order matters: a self-write is also "the current disk revision", so the
/// self-write check must win over `Unchanged`. The disk revision is updated by
/// the caller when the kind is `External` (or `SelfWrite`).
pub fn classify_change(
    current_revision: &DiskRevision,
    disk_revision: &DiskRevision,
    last_self_write: Option<&DiskRevision>,
) -> ChangeKind {
    if last_self_write == Some(current_revision) {
        ChangeKind::SelfWrite
    } else if current_revision == disk_revision {
        ChangeKind::Unchanged
    } else {
        ChangeKind::External
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rev(s: &str) -> DiskRevision {
        DiskRevision::compute(s.as_bytes())
    }

    #[test]
    fn classify_self_write_wins_over_unchanged() {
        let current = rev("abc");
        let disk = rev("abc");
        let last_self = Some(rev("abc"));
        assert_eq!(
            classify_change(&current, &disk, last_self.as_ref()),
            ChangeKind::SelfWrite
        );
    }

    #[test]
    fn classify_unchanged() {
        let current = rev("abc");
        let disk = rev("abc");
        assert_eq!(
            classify_change(&current, &disk, None),
            ChangeKind::Unchanged
        );
    }

    #[test]
    fn classify_external_when_differs() {
        let current = rev("xyz");
        let disk = rev("abc");
        let last_self = Some(rev("abc"));
        assert_eq!(
            classify_change(&current, &disk, last_self.as_ref()),
            ChangeKind::External
        );
    }

    #[test]
    fn registry_tracks_self_write_and_disk() {
        let id = SessionId::generate();
        let mut reg = SourceRevisionRegistry::default();
        let before = rev("before");
        reg.note_disk_revision(&id, before.clone());
        assert_eq!(
            classify_change(&before, &reg.state(&id).unwrap().disk_revision, None),
            ChangeKind::Unchanged
        );

        let written = rev("written");
        reg.note_self_write(&id, written.clone());
        let s = reg.state(&id).unwrap();
        assert_eq!(s.last_self_write, Some(written.clone()));
        assert_eq!(s.disk_revision, written);
    }

    #[test]
    fn registry_remove_discards_late_events() {
        let id = SessionId::generate();
        let mut reg = SourceRevisionRegistry::default();
        reg.note_disk_revision(&id, rev("abc"));
        assert!(reg.remove(&id).is_some());
        assert!(reg.state(&id).is_none());
    }
}
