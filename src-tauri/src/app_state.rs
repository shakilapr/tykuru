//! Managed application state.
//!
//! Holds the single `SessionManager` behind a `Mutex` and the cache root derived
//! once at startup. Tauri commands read this via `tauri::State`.

use std::path::PathBuf;
use std::sync::Mutex;

use crate::session::SessionManager;

/// Top-level managed state for the backend.
pub struct AppState {
    /// Single active document session (see `architecture.md §8.2`).
    pub session_manager: Mutex<SessionManager>,
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
            cache_root,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
