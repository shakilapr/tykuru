//! Live `typst watch` manager: enforces exactly one watcher per active session.

use std::sync::Mutex;

use tokio_util::sync::CancellationToken;

use super::sidecar::{compile_once, CompilerError, CompilerProcess};
use crate::session::SessionId;

/// Owns the single running `typst watch` child for the active session.
///
/// `start` refuses a second watcher for the same session (architecture §8.2);
/// the previous session's watcher must be stopped first. A `CancellationToken`
/// aids orderly shutdown but correctness still comes from `SessionId` checks
/// (architecture §8.3).
pub struct CompilerManager {
    process: Mutex<Option<CompilerProcess>>,
    token: CancellationToken,
}

impl CompilerManager {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            token: CancellationToken::new(),
        }
    }

    /// Spawns a watcher for `session_id`. Returns an error if a watcher is
    /// already running (no duplicate child allowed).
    pub fn start(
        &self,
        app: &tauri::AppHandle,
        session_id: &SessionId,
    ) -> Result<(), CompilerError> {
        let mut guard = self.process.lock().map_err(|_| CompilerError::Killed)?;
        if guard.is_some() {
            return Err(CompilerError::AlreadyRunning);
        }
        let proc = CompilerProcess::start_watch(app, session_id)?;
        *guard = Some(proc);
        Ok(())
    }

    /// Stops the running watcher (if any) and waits for it to exit.
    pub fn stop(&self) -> Result<(), CompilerError> {
        let proc = self
            .process
            .lock()
            .map_err(|_| CompilerError::Killed)?
            .take();
        if let Some(p) = proc {
            p.stop()?;
        }
        Ok(())
    }

    /// True when a watcher is currently running.
    pub fn is_running(&self) -> bool {
        self.process.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    /// Cancels the shutdown token (used by `ShutdownCoordinator`).
    pub fn cancel(&self) {
        self.token.cancel();
    }

    pub fn token(&self) -> CancellationToken {
        self.token.clone()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CompilerError {
    #[error(transparent)]
    Spawn(#[from] super::sidecar::CompileError),
    #[error("a watcher is already running for the active session")]
    AlreadyRunning,
    #[error("lock poisoned")]
    Killed,
}
