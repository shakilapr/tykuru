//! Managed application state.
//!
//! Holds the single `SessionManager` behind a `Mutex` and the cache root derived
//! once at startup. Tauri commands read this via `tauri::State`.

use std::path::PathBuf;
use std::sync::Mutex;

use notify::RecommendedWatcher;
use crate::preview::RevisionRegistry;
use crate::session::SessionManager;

/// Top-level managed state for the backend.
pub struct AppState {
    /// Single active document session (see `architecture.md §8.2`).
    pub session_manager: Mutex<SessionManager>,
    /// Per-session immutable preview revision ledger (see `architecture.md §12`).
    pub revision_registry: Mutex<RevisionRegistry>,
    /// Live candidate watcher for the active session (dropped on close/open).
    pub candidate_watcher: Mutex<Option<RecommendedWatcher>>,
    /// Tykuru cache root; all generated output is bounded under this path.
    pub cache_root: PathBuf,
}

impl AppState {
    /// Builds the managed state, resolving the Tykuru cache root.
    pub fn new() -> Self {
        let cache_root = crate::open_request::tykuru_cache_root()
            .unwrap_or_else(|| PathBuf::from(".tykuru-cache"));
        Self {
            session_manager: Mutex::new(SessionManager::new()),
            revision_registry: Mutex::new(RevisionRegistry::default()),
            candidate_watcher: Mutex::new(None),
            cache_root,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
