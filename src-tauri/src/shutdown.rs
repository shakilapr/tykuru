//! Shutdown coordinator: ensures no `typst.exe` is left running on exit.
//!
//! On app exit, stop the active session's `typst watch` and await its child so
//! the process is gone before Tauri closes (architecture §8.2, §3.5). This is a
//! best-effort, synchronous teardown; the Windows acceptance test (Stage 17/20)
//! asserts no orphan `typst.exe` after upgrade/reinstall/shutdown.

use tauri::{AppHandle, Manager};

use crate::app_state::AppState;
use crate::compiler::CompilerError;

/// Stops the compiler watcher for the active session and waits for exit.
pub fn shutdown(app: &AppHandle) -> Result<(), CompilerError> {
    let state = app.state::<AppState>();
    state.compiler_manager.stop()
}
