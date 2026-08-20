//! Compiler subsystem: owns the bundled Typst sidecar lifecycle.

pub mod diagnostic;
pub mod manager;
pub mod sidecar;

pub use manager::{CompilerError, CompilerManager};
pub use sidecar::{compile_once, CompileError, CompileOutcome};

use tauri::{AppHandle, Manager, Runtime};

use crate::app_state::AppState;
use crate::session::SessionId;

/// Spawns a live `typst watch` for the active session. Refuses a duplicate
/// watcher (architecture §8.2). Replaces the one-shot compile in the open flow;
/// `compile_once` remains available as a test helper / fallback.
pub fn start_watch<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &SessionId,
) -> Result<(), CompilerError> {
    let state = app.state::<AppState>();
    state.compiler_manager.start(app, session_id)
}

/// Stops the running watcher and waits for the child to exit.
pub fn stop_watch<R: Runtime>(app: &AppHandle<R>) -> Result<(), CompilerError> {
    let state = app.state::<AppState>();
    state.compiler_manager.stop()
}
