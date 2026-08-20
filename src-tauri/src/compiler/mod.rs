//! Compiler subsystem: owns the bundled Typst sidecar lifecycle.

pub mod sidecar;

pub use sidecar::{CompileError, CompileOutcome};

use tauri::AppHandle;

use crate::session::SessionId;

/// Thin coordinator over the Typst sidecar. Later stages (Stage 6) extend this
/// with a `typst watch` process; the one-shot path lives in `sidecar.rs`.
pub struct CompilerService;

impl CompilerService {
    /// Runs a single `typst compile` for the active session matching `session_id`.
    pub fn compile_once(
        app: &AppHandle,
        session_id: &SessionId,
    ) -> Result<CompileOutcome, CompileError> {
        sidecar::compile_once(app, session_id)
    }
}
