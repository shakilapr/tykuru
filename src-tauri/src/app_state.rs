//! Managed application state.
//!
//! Holds the single `SessionManager` behind a `Mutex` and the cache root derived
//! once at startup. Tauri commands read this via `tauri::State`.

use std::path::PathBuf;
use std::sync::Mutex;

use crate::compiler::diagnostic::CompileStateRegistry;
use crate::compiler::CompilerManager;
use crate::preview::RevisionRegistry;
use crate::session::SessionManager;
use notify::RecommendedWatcher;

/// Top-level managed state for the backend.
pub struct AppState {
    /// Single active document session (see `architecture.md §8.2`).
    pub session_manager: Mutex<SessionManager>,
    /// Per-session immutable preview revision ledger (see `architecture.md §12`).
    pub revision_registry: Mutex<RevisionRegistry>,
    /// Per-session compile-state ledger (see `architecture.md §11.4`).
    pub compile_states: Mutex<CompileStateRegistry>,
    /// Live `typst watch` manager (one watcher for the active session).
    pub compiler_manager: CompilerManager,
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
            compile_states: Mutex::new(CompileStateRegistry::default()),
            compiler_manager: CompilerManager::new(),
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
