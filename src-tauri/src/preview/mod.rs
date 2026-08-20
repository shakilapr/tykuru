//! Preview publication pipeline: candidate → immutable revision → binary IPC.

pub mod delivery;
pub mod output_watch;
pub mod revisions;

pub use revisions::{PreviewRevision, RevisionError, RevisionRegistry};

use tauri::{Manager, Runtime};

/// Verifies and commits a candidate snapshot as a new immutable revision for the
/// active session. Shared by `output_watch` (watcher) and tests/commands.
#[allow(dead_code)]
pub fn commit_candidate<R: Runtime>(
    app: &tauri::AppHandle<R>,
    session_id: &crate::session::SessionId,
    candidate_path: &std::path::Path,
) -> Result<PreviewRevision, RevisionError> {
    let cache_dir = {
        let state = app.state::<crate::app_state::AppState>();
        let manager = state
            .session_manager
            .lock()
            .map_err(|_| RevisionError::NoActiveSession)?;
        let session = manager
            .get_active()
            .filter(|s| &s.id == session_id)
            .ok_or(RevisionError::NoActiveSession)?;
        session.cache_dir.clone()
    };
    let bytes = revisions::read_stable_candidate(candidate_path)?;
    if bytes.is_empty() {
        return Err(RevisionError::Empty);
    }
    if !revisions::looks_like_pdf(&bytes) {
        return Err(RevisionError::NotPdf);
    }
    let state = app.state::<crate::app_state::AppState>();
    let mut registry = state
        .revision_registry
        .lock()
        .map_err(|_| RevisionError::NoActiveSession)?;
    let revision = registry
        .store_mut(session_id)
        .commit(session_id, &cache_dir, &bytes)?;
    drop(registry);
    delivery::emit_preview_updated(app, session_id, revision.number);
    Ok(revision)
}
