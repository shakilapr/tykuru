//! Session manager: enforces the single-active-session invariant.
//!
//! v1 allows exactly one active `DocumentSession` (architecture §8.2). Opening a
//! new file tears the previous session down first, so the previous `SessionId`
//! is never retrievable afterward. This identity is what lets later stages
//! reject stale compiler/preview events from a closed session.

use std::path::{Path, PathBuf};

use super::model::{DocumentSession, SessionId};

/// Holds at most one active document session.
#[derive(Default)]
pub struct SessionManager {
    active: Option<DocumentSession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Opens `entry_path` as a new session, replacing any previous one.
    ///
    /// Returns the id of the newly created session.
    pub fn open(
        &mut self,
        entry_path: PathBuf,
        cache_root: &Path,
    ) -> Result<SessionId, super::model::SessionError> {
        let session = DocumentSession::new(entry_path, cache_root)?;
        let id = session.id.clone();
        self.active = Some(session);
        Ok(id)
    }

    /// Closes the active session if it matches `session_id`.
    ///
    /// Returns an error if there is no active session or it is not the one
    /// requested (stale close must not tear down a newer session).
    pub fn close(&mut self, session_id: &SessionId) -> Result<(), CloseError> {
        match self.active.take() {
            Some(session) if &session.id == session_id => Ok(()),
            Some(other) => {
                self.active = Some(other);
                Err(CloseError::NotActive)
            }
            None => Err(CloseError::NoActiveSession),
        }
    }

    /// Returns the active session, if any.
    pub fn get_active(&self) -> Option<&DocumentSession> {
        self.active.as_ref()
    }

    /// Returns the active session id, if any.
    pub fn active_id(&self) -> Option<&SessionId> {
        self.active.as_ref().map(|s| &s.id)
    }

    /// Updates the project root of the session identified by `session_id`.
    ///
    /// A stale id is rejected so a root change cannot be applied to a newer
    /// session (architecture §8.3). The caller has already validated the root;
    /// this only mutates the manager's owned session.
    pub fn update_root(
        &mut self,
        session_id: &SessionId,
        project_root: PathBuf,
    ) -> Result<(), CloseError> {
        match self.active.as_mut() {
            Some(session) if &session.id == session_id => {
                session.project_root = project_root;
                Ok(())
            }
            Some(_) => Err(CloseError::NotActive),
            None => Err(CloseError::NoActiveSession),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CloseError {
    #[error("no active session to close")]
    NoActiveSession,
    #[error("requested session is not the active session")]
    NotActive,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_entry(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(name);
        std::fs::write(&path, b"x").expect("write");
        path
    }

    #[test]
    fn opening_b_replaces_logical_session_a() {
        let mut manager = SessionManager::new();
        let cache = std::env::temp_dir().join("tykuru_mgr_cache");
        let a = temp_entry("tykuru_A.typ");
        let b = temp_entry("tykuru_B.typ");
        let id_a = manager.open(a.clone(), &cache).unwrap();
        let id_b = manager.open(b.clone(), &cache).unwrap();
        assert_ne!(id_a, id_b);
        // A is no longer retrievable.
        assert_ne!(manager.active_id(), Some(&id_a));
        assert_eq!(manager.active_id(), Some(&id_b));
        assert_eq!(manager.get_active().unwrap().entry_path, b);
        let _ = std::fs::remove_file(&a);
        let _ = std::fs::remove_file(&b);
    }

    #[test]
    fn close_requires_active_session() {
        let mut manager = SessionManager::new();
        let id = SessionId::generate();
        assert!(matches!(
            manager.close(&id),
            Err(CloseError::NoActiveSession)
        ));
    }

    #[test]
    fn close_ignores_stale_id() {
        let mut manager = SessionManager::new();
        let cache = std::env::temp_dir().join("tykuru_mgr_cache");
        let entry = temp_entry("tykuru_close.typ");
        let id = manager.open(entry.clone(), &cache).unwrap();
        let stale = SessionId::generate();
        assert!(matches!(manager.close(&stale), Err(CloseError::NotActive)));
        // Active session still present.
        assert_eq!(manager.active_id(), Some(&id));
        let _ = std::fs::remove_file(&entry);
    }
}
