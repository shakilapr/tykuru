//! Document session model.
//!
//! A `DocumentSession` is Tykuru's in-memory representation of the single active
//! Typst source file. It owns the entry path, the derived project root, and the
//! per-session cache directory. Later stages attach compiler/preview/editor
//! state to it (see `architecture.md §8.1`).

use std::path::{Path, PathBuf};

use serde::Serialize;
use thiserror::Error;

/// Identifier for a session, distinct from paths so that stale events can be
/// rejected by identity rather than by re-resolving paths.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub struct SessionId(String);

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("session id must not be empty")]
    EmptyId,
}

impl SessionId {
    pub fn new(id: String) -> Result<Self, SessionError> {
        if id.is_empty() {
            return Err(SessionError::EmptyId);
        }
        Ok(Self(id))
    }

    /// Generates a fresh, random session id (UUID v4).
    pub fn generate() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// A single active Typst document session.
#[derive(Debug, Clone)]
pub struct DocumentSession {
    pub id: SessionId,
    pub entry_path: PathBuf,
    pub project_root: PathBuf,
    pub cache_dir: PathBuf,
}

impl DocumentSession {
    /// Builds a session from a validated, canonicalized entry path.
    ///
    /// The project root defaults to the parent directory of the entry file
    /// (see `architecture.md §10`). The cache directory is a per-session
    /// subdirectory of `cache_root`, keeping generated output bounded to the
    /// Tykuru cache (architecture §17 / §27.5).
    pub fn new(entry_path: PathBuf, cache_root: &Path) -> Result<Self, SessionError> {
        let id = SessionId::generate();
        let project_root = entry_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        let cache_dir = cache_root.join(format!("session-{}", id.as_str()));
        Ok(Self {
            id,
            entry_path,
            project_root,
            cache_dir,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_root_is_parent_of_entry() {
        let entry = PathBuf::from("C:\\Tykuru Test\\main.typ");
        let session = DocumentSession::new(entry, Path::new("C:\\cache")).unwrap();
        assert_eq!(session.project_root, PathBuf::from("C:\\Tykuru Test"));
    }

    #[test]
    fn cache_dir_lives_under_cache_root() {
        let entry = PathBuf::from("C:\\Tykuru Test\\main.typ");
        let cache_root = PathBuf::from("C:\\LocalAppData\\Tykuru\\cache");
        let session = DocumentSession::new(entry, &cache_root).unwrap();
        assert!(session.cache_dir.starts_with(&cache_root));
        assert!(session
            .cache_dir
            .to_string_lossy()
            .contains(session.id.as_str()));
    }

    #[test]
    fn session_id_is_non_empty() {
        assert!(SessionId::new("".to_string()).is_err());
        let id = SessionId::generate();
        assert!(!id.as_str().is_empty());
    }
}
