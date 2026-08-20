//! Compiler subsystem: owns the bundled Typst sidecar lifecycle (Stage 3).
//!
//! Stage 3 performs a one-shot `typst compile`. The watcher (Stage 6) builds on
//! the same sidecar primitive. Typst is launched only through the Tauri shell
//! plugin's sidecar API with arguments passed separately — never via a shell
//! string, `cmd.exe`, `powershell`, or `sh` (architecture §11.2, §6.2.1).
//!
//! API note: `tauri-plugin-shell` 2.x `spawn()` returns `(Receiver<CommandEvent>,
//! CommandChild)`; stdout/stderr arrive as `CommandEvent` variants on the
//! receiver. `CommandChild` has no `wait()`/`stderr()`; termination is signalled
//! via `CommandEvent::Terminated` and `kill()` is synchronous on the child.

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
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
    #[error("no active session to compile")]
    NoActiveSession,
    #[error("typst process killed before completion")]
    Killed,
}

/// Builds and runs a one-shot `typst compile` for the given entry into the
/// candidate PDF path.
///
/// `candidate.pdf` is written under the session cache dir, never into the
/// project directory (architecture §17, Stage 3). Async because the shell
/// plugin's `output()` is async; Tauri async commands run on the runtime.
pub async fn compile_once<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &crate::session::SessionId,
) -> Result<CompileOutcome, CompileError> {
    let state = app.state::<crate::app_state::AppState>();
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

    let output = command.output().await.map_err(CompileError::Spawn)?;

    let stderr = truncate_lossy(&output.stderr, STDERR_LIMIT);
    Ok(CompileOutcome {
        success: output.status.success(),
        exit_code: output.status.code(),
        stderr,
        candidate_path,
    })
}

/// A running `typst watch` process for one active session.
///
/// The child handle is retained so `ShutdownCoordinator` / `CompilerManager` can
/// `kill()` it on close or app exit (architecture §11.2, §8.2). stderr is read
/// from the command-event receiver on a Tauri async task.
pub struct CompilerProcess {
    /// Retained so tests/commands can identify the running watcher's session.
    #[allow(dead_code)]
    pub session_id: crate::session::SessionId,
    child: Option<CommandChild>,
}

impl CompilerProcess {
    /// Spawns `typst watch <entry> <candidate.pdf> --root <project_root>` and
    /// returns the retained child. Arguments are passed separately (no shell).
    pub fn start_watch<R: Runtime>(
        app: &AppHandle<R>,
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

        let (mut rx, child) = app
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

        // `typst watch` has no per-build exit; derive compile state from its
        // stderr. A line mentioning an error becomes an `Error` state (bounded
        // diagnostic). Successful commits flip it back to `Ready` in the output
        // watcher (architecture §11.4).
        let diag_app = app.clone();
        let diag_id = session_id.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                if let CommandEvent::Stderr(line) = event {
                    let text = String::from_utf8_lossy(&line).trim().to_string();
                    if text.to_lowercase().contains("error") {
                        crate::compiler::diagnostic::set_compile_state(
                            &diag_app,
                            &diag_id,
                            crate::compiler::diagnostic::CompileState::Error {
                                message: crate::compiler::diagnostic::bound_diagnostic(&text),
                                last_good_revision: None,
                            },
                        );
                    }
                }
            }
        });

        Ok(Self {
            session_id: session_id.clone(),
            child: Some(child),
        })
    }

    /// Kills the child. `CommandChild::kill` consumes the handle and is
    /// synchronous on the shared child, so the process is terminated before
    /// this returns (architecture §8.2).
    pub fn stop(&mut self) -> Result<(), CompileError> {
        if let Some(child) = self.child.take() {
            child.kill().map_err(CompileError::Spawn)?;
        }
        Ok(())
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
