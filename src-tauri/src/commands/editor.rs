//! Editor commands: read/save the active session's source file.
//!
//! Narrow and typed (§20): the frontend never supplies a path; it identifies the
//! session and passes the expected disk revision so the backend can detect
//! external-edit conflicts (§15.2).

use tauri::{Manager, Runtime};

use crate::app_state::AppState;
use crate::commands::document::CommandError;
use crate::session::SessionId;
use crate::source::{read_source, save_source, DiskRevision};

#[derive(Debug, serde::Serialize)]
pub struct SourceSnapshot {
    pub session_id: String,
    pub content: String,
    pub disk_revision: String,
}

#[derive(Debug, serde::Serialize)]
pub struct SaveResult {
    pub disk_revision: String,
}

fn parse_id(raw: &str) -> Result<SessionId, CommandError> {
    SessionId::new(raw.to_string()).map_err(|_| CommandError::InvalidSessionId(raw.to_string()))
}

/// Returns the active session's entry source text and its current disk revision.
#[tauri::command]
pub fn read_source_command<R: Runtime>(
    session_id: String,
    app: tauri::AppHandle<R>,
) -> Result<SourceSnapshot, CommandError> {
    let id = parse_id(&session_id)?;
    let state = app.state::<AppState>();
    let manager = state
        .session_manager
        .lock()
        .map_err(|_| CommandError::LockPoisoned)?;
    let session = manager
        .get_active()
        .filter(|s| s.id == id)
        .ok_or(CommandError::NoActiveSession)?;
    let content = read_source(&session.entry_path)?;
    let disk_revision = DiskRevision::compute(content.as_bytes());
    // Record the disk revision so the source watcher's classification is
    // grounded on what the frontend actually loaded (§16.3).
    if let Ok(mut reg) = state.source_revision_registry.lock() {
        reg.note_disk_revision(&id, disk_revision.clone());
    }
    Ok(SourceSnapshot {
        session_id,
        content,
        disk_revision: disk_revision.as_str().to_string(),
    })
}

/// Saves `content` to the active session's entry file iff its disk revision
/// still matches `expected_disk_revision`.
#[tauri::command]
pub fn save_source_command<R: Runtime>(
    session_id: String,
    content: String,
    expected_disk_revision: String,
    app: tauri::AppHandle<R>,
) -> Result<SaveResult, CommandError> {
    let id = parse_id(&session_id)?;
    let state = app.state::<AppState>();
    let entry_path = {
        let manager = state
            .session_manager
            .lock()
            .map_err(|_| CommandError::LockPoisoned)?;
        manager
            .get_active()
            .filter(|s| s.id == id)
            .map(|s| s.entry_path.clone())
            .ok_or(CommandError::NoActiveSession)?
    };

    let expected = DiskRevision::from_hex(&expected_disk_revision);
    let new_revision = DiskRevision::compute(content.as_bytes());
    // Record the self-write identity BEFORE the write becomes observable so the
    // source watcher ignores our own notification (§15.3).
    if let Ok(mut reg) = state.source_revision_registry.lock() {
        reg.note_self_write(&id, new_revision.clone());
    }
    let manager = state
        .session_manager
        .lock()
        .map_err(|_| CommandError::LockPoisoned)?;
    let _new_rev = save_source(&manager, &id, &entry_path, &content, &expected)?;
    Ok(SaveResult {
        disk_revision: new_revision.as_str().to_string(),
    })
}

/// Writes the local buffer over disk as the deliberate, user-authorized
/// resolution of a source conflict (§16.4 "Keep my version").
///
/// `expected_external_revision` is the external revision the conflict was
/// detected against. `SourceWriter::save` re-checks disk; if a newer external
/// write landed in the meantime the write is rejected and `Conflict` remains
/// (the frontend refreshes the snapshot to the newest revision).
#[tauri::command]
pub fn resolve_source_conflict_keep_local_command<R: Runtime>(
    session_id: String,
    content: String,
    expected_external_revision: String,
    app: tauri::AppHandle<R>,
) -> Result<SaveResult, CommandError> {
    let id = parse_id(&session_id)?;
    let state = app.state::<AppState>();
    let entry_path = {
        let manager = state
            .session_manager
            .lock()
            .map_err(|_| CommandError::LockPoisoned)?;
        manager
            .get_active()
            .filter(|s| s.id == id)
            .map(|s| s.entry_path.clone())
            .ok_or(CommandError::NoActiveSession)?
    };

    let expected = DiskRevision::from_hex(&expected_external_revision);
    let new_revision = DiskRevision::compute(content.as_bytes());
    // Record self-write before the write so the watcher suppresses our own event.
    if let Ok(mut reg) = state.source_revision_registry.lock() {
        reg.note_self_write(&id, new_revision.clone());
    }
    let manager = state
        .session_manager
        .lock()
        .map_err(|_| CommandError::LockPoisoned)?;
    let _new_rev = save_source(&manager, &id, &entry_path, &content, &expected)?;
    Ok(SaveResult {
        disk_revision: new_revision.as_str().to_string(),
    })
}
