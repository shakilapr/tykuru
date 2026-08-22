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
use crate::settings::SettingsStore;
use crate::source::SourceRevisionRegistry;
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
    /// Per-session source-revision ledger (self-write + disk identity, §15.3).
    pub source_revision_registry: Mutex<SourceRevisionRegistry>,
    /// Live entry-file watcher for editor synchronization (dropped on close/open).
    pub source_watcher: Mutex<Option<RecommendedWatcher>>,
    /// Tykuru cache root; all generated output is bounded under this path.
    pub cache_root: PathBuf,
    /// Typed settings store (atomic persistence, architecture §18).
    pub settings_store: SettingsStore,
}

impl AppState {
    /// Builds the managed state, resolving the Tykuru cache root.
    pub fn new() -> Self {
        let cache_root = crate::open_request::tykuru_cache_root()
            .unwrap_or_else(|| PathBuf::from(".tykuru-cache"));
        let config_root = crate::open_request::tykuru_config_root()
            .unwrap_or_else(|| PathBuf::from(".tykuru-config"));
        Self {
            session_manager: Mutex::new(SessionManager::new()),
            revision_registry: Mutex::new(RevisionRegistry::default()),
            compile_states: Mutex::new(CompileStateRegistry::default()),
            compiler_manager: CompilerManager::new(),
            candidate_watcher: Mutex::new(None),
            source_revision_registry: Mutex::new(SourceRevisionRegistry::default()),
            source_watcher: Mutex::new(None),
            cache_root,
            settings_store: SettingsStore::new(config_root),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
