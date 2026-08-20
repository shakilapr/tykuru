//! Managed application state.
//!
//! Stage 0 owns a minimal placeholder. Session/document state is added in
//! later stages (see `architecture.md §8` and `work-plan.md`).

use std::sync::Mutex;

/// Top-level managed state for the backend.
#[derive(Default)]
pub struct AppState {
    pub started: Mutex<bool>,
}
