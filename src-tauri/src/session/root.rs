//! Project-root selection and validation (architecture §10).
//!
//! The default project root is `parent(entry.typ)`. For documents that import
//! outside that directory, the user can set an explicit root. This module
//! validates and applies a root change on the active session. Persistence of the
//! override (SettingsV1.root_overrides) is handled by the settings layer (Stage
//! 16); this module only mutates the live session.

use std::path::{Path, PathBuf};

use thiserror::Error;

use super::model::DocumentSession;

#[derive(Debug, Error)]
pub enum RootError {
    #[error("root path is empty")]
    Empty,
    #[error("root is not an existing directory: {0}")]
    NotDirectory(PathBuf),
    #[error("root could not be canonicalized: {0}")]
    Canonicalize(#[source] std::io::Error),
}

/// Applies and validates a project-root override on a session.
pub struct ProjectRootService;

impl ProjectRootService {
    /// Validates `root` and updates `session.project_root`.
    ///
    /// The root must exist and be a directory. The canonicalized form is stored.
    pub fn set_root(session: &mut DocumentSession, root: &Path) -> Result<PathBuf, RootError> {
        let trimmed = root.to_string_lossy().trim().to_string();
        if trimmed.is_empty() {
            return Err(RootError::Empty);
        }
        if !root.is_dir() {
            return Err(RootError::NotDirectory(root.to_path_buf()));
        }
        let canonical = root.canonicalize().map_err(RootError::Canonicalize)?;
        session.project_root = canonical.clone();
        Ok(canonical)
    }

    /// Clears a root override, returning to the default `parent(entry)`.
    pub fn clear_root(session: &mut DocumentSession) -> PathBuf {
        let default = session
            .entry_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        session.project_root = default.clone();
        default
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::DocumentSession;

    fn temp_session() -> DocumentSession {
        let dir = std::env::temp_dir();
        let entry = dir.join("tykuru_root_entry.typ");
        std::fs::write(&entry, b"x").expect("write");
        DocumentSession::new(entry, &dir).expect("session")
    }

    #[test]
    fn set_root_validates_and_canonicalizes_directory() {
        let mut session = temp_session();
        let dir = std::env::temp_dir();
        let canonical = ProjectRootService::set_root(&mut session, &dir).unwrap();
        assert!(canonical.is_absolute());
        assert_eq!(session.project_root, canonical);
    }

    #[test]
    fn set_root_rejects_missing_or_file_root() {
        let mut session = temp_session();
        let missing = std::env::temp_dir().join("tykuru_no_such_root_123");
        assert!(matches!(
            ProjectRootService::set_root(&mut session, &missing),
            Err(RootError::NotDirectory(_))
        ));
        let file = std::env::temp_dir().join("tykuru_root_file.typ");
        std::fs::write(&file, b"x").expect("write");
        assert!(matches!(
            ProjectRootService::set_root(&mut session, &file),
            Err(RootError::NotDirectory(_))
        ));
        let _ = std::fs::remove_file(&file);
    }

    #[test]
    fn set_root_rejects_empty() {
        let mut session = temp_session();
        assert!(matches!(
            ProjectRootService::set_root(&mut session, Path::new("  ")),
            Err(RootError::Empty)
        ));
    }

    #[test]
    fn clear_root_returns_to_parent() {
        let mut session = temp_session();
        let dir = std::env::temp_dir();
        let _ = ProjectRootService::set_root(&mut session, &dir).unwrap();
        let default = ProjectRootService::clear_root(&mut session);
        assert_eq!(session.project_root, default);
        assert!(session.entry_path.parent().is_some());
    }
}
