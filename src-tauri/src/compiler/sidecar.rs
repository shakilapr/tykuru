//! Compiler subsystem: owns the bundled Typst sidecar lifecycle (Stage 3).
//!
//! Stage 3 performs a one-shot `typst compile`. The watcher (Stage 6) builds on
//! the same sidecar primitive. Typst is launched only through the Tauri shell
//! plugin's sidecar API with arguments passed separately — never via a shell
//! string, `cmd.exe`, `powershell`, or `sh` (architecture §11.2, §6.2.1).

use std::path::PathBuf;

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Bounded diagnostic buffer so a chatty compiler cannot exhaust memory.
const STDERR_LIMIT: usize = 64 * 1024;

/// Outcome of a single compile attempt.
#[derive(Debug, Clone, Serialize)]
pub struct CompileOutcome {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stderr: String,
    pub candidate_path: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum CompileError {
    #[error("failed to spawn typst sidecar: {0}")]
    Spawn(#[source] tauri_plugin_shell::Error),
    #[error("typst sidecar produced malformed output: {0}")]
    Output(#[source] std::io::Error),
    #[error("no active session to compile")]
    NoActiveSession,
    #[error("typst process killed before completion")]
    Killed,
}

/// Builds and runs a one-shot `typst compile` for the given entry into the
/// candidate PDF path.
///
/// `candidate.pdf` is written under the session cache dir, never into the
/// project directory (architecture §17, Stage 3).
pub fn compile_once(
    app: &tauri::AppHandle,
    session_id: &crate::session::SessionId,
) -> Result<CompileOutcome, CompileError> {
    let state = app.state::<crate::app_state::AppState>();
    let cache_root = state.cache_root.clone();
    let (entry_path, project_root, candidate_path) = {
        let manager = state
            .session_manager
            .lock()
            .map_err(|_| CompileError::Killed)?;
        let session = manager
            .get_active()
            .filter(|s| &s.id == session_id)
            .ok_or(CompileError::NoActiveSession)?;
        let candidate = session.cache_dir.join("candidate.pdf");
        (
            session.entry_path.clone(),
            session.project_root.clone(),
            candidate,
        )
    };

    let command = app
        .shell()
        .sidecar("typst")
        .map_err(CompileError::Spawn)?
        .args([
            "compile",
            entry_path.to_str().unwrap_or(""),
            candidate_path.to_str().unwrap_or(""),
            "--root",
            project_root.to_str().unwrap_or(""),
        ]);

    let output = command.output().map_err(|e| CompileError::Spawn(e))?;

    let stderr = truncate_lossy(&output.stderr, STDERR_LIMIT);
    let outcome = CompileOutcome {
        success: output.status.success(),
        exit_code: output.status.code(),
        stderr,
        candidate_path: candidate_path.clone(),
    };
    Ok(outcome)
}

/// A running `typst watch` process for one active session.
///
/// The child handle is retained so `ShutdownCoordinator` / `CompilerManager` can
/// `kill()` it on close or app exit (architecture §11.2, §8.2).
pub struct CompilerProcess {
    pub session_id: crate::session::SessionId,
    child: CommandChild,
}

impl CompilerProcess {
    /// Spawns `typst watch <entry> <candidate.pdf> --root <project_root>` and
    /// returns the retained child. Arguments are passed separately (no shell).
    pub fn start_watch(
        app: &tauri::AppHandle,
        session_id: &crate::session::SessionId,
    ) -> Result<Self, CompileError> {
        let (entry_path, project_root, candidate_path) = {
            let state = app.state::<crate::app_state::AppState>();
            let manager = state
                .session_manager
                .lock()
                .map_err(|_| CompileError::Killed)?;
            let session = manager
                .get_active()
                .filter(|s| &s.id == session_id)
                .ok_or(CompileError::NoActiveSession)?;
            (
                session.entry_path.clone(),
                session.project_root.clone(),
                session.cache_dir.join("candidate.pdf"),
            )
        };

        let child = app
            .shell()
            .sidecar("typst")
            .map_err(CompileError::Spawn)?
            .args([
                "watch",
                entry_path.to_str().unwrap_or(""),
                candidate_path.to_str().unwrap_or(""),
                "--root",
                project_root.to_str().unwrap_or(""),
            ])
            .spawn()
            .map_err(CompileError::Spawn)?;

        Ok(Self {
            session_id: session_id.clone(),
            child,
        })
    }

    /// Kills the child and waits (with a timeout) for it to exit, so the process
    /// is guaranteed gone before shutdown completes (architecture §8.2).
    pub fn stop(mut self) -> Result<(), CompileError> {
        // Best-effort kill; ignore "already exited".
        let _ = self.child.kill();
        match self.child.wait() {
            Ok(_) => Ok(()),
            Err(e) => Err(CompileError::Output(e)),
        }
    }
}

/// Captures stderr as a String, bound to the last `limit` bytes to avoid
/// unbounded memory growth (architecture §11.4).
fn truncate_lossy(bytes: &[u8], limit: usize) -> String {
    if bytes.len() <= limit {
        return String::from_utf8_lossy(bytes).into_owned();
    }
    String::from_utf8_lossy(&bytes[bytes.len() - limit..]).into_owned()
}
