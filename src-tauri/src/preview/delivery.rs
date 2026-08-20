//! Preview delivery over binary Tauri IPC.
//!
//! The frontend never supplies a path; it asks for a revision by session +
//! revision identity, and the backend resolves the internally known file and
//! returns its bytes as an `ArrayBuffer` (architecture §13). Unknown session or
//! revision is rejected; resolution can never escape the session cache root.

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::app_state::AppState;
use crate::session::SessionId;

#[derive(Debug, thiserror::Error)]
pub enum DeliveryError {
    #[error("unknown session")]
    UnknownSession,
    #[error("unknown revision")]
    UnknownRevision,
    #[error("lock poisoned")]
    Lock,
    #[error("failed to read revision file: {0}")]
    Read(#[source] std::io::Error),
}

/// Reads the bytes of a published revision and returns them.
///
/// Resolved only by session/revision identity; the path is internal. Rejects
/// stale/unknown sessions and unpublished revisions before any filesystem read.
pub fn get_preview_pdf<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &SessionId,
    revision: u64,
) -> Result<Vec<u8>, DeliveryError> {
    let state = app.state::<AppState>();
    {
        let manager = state
            .session_manager
            .lock()
            .map_err(|_| DeliveryError::Lock)?;
        if manager.active_id() != Some(session_id) {
            return Err(DeliveryError::UnknownSession);
        }
    }
    let registry = state
        .revision_registry
        .lock()
        .map_err(|_| DeliveryError::Lock)?;
    let store = registry
        .store(session_id)
        .ok_or(DeliveryError::UnknownSession)?;
    if !store.is_published(revision) {
        return Err(DeliveryError::UnknownRevision);
    }
    let path = store
        .path_for(revision)
        .cloned()
        .ok_or(DeliveryError::UnknownRevision)?;
    drop(registry);

    std::fs::read(&path).map_err(DeliveryError::Read)
}

/// Emits `preview-updated` after a successful commit. The name lives next to
/// delivery; the frontend consumes it in Stage 5.
pub fn emit_preview_updated<R: Runtime>(app: &AppHandle<R>, session_id: &SessionId, revision: u64) {
    let _ = app.emit("preview-updated", (session_id.as_str(), revision));
}
