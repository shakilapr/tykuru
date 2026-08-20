//! Tauri commands for document/session lifecycle.
//!
//! These are the narrow, typed surface the frontend may call (architecture §20).
//! They never expose generic filesystem/process access; all validation and
//! session ownership lives in `OpenRequestRouter` and `SessionManager`.

use serde::Serialize;
use tauri::{Manager, State};

use crate::app_state::AppState;
use crate::compiler::{CompileError, CompileOutcome};
use crate::open_request::{OpenRequestError, OpenRequestRouter};
use crate::session::{CloseError, SessionId};

/// Serializable subset of a session safe to surface to the frontend.
///
/// Only the id, the bare filename, and entry-path basename are exposed — never
/// the full resolved path is required by the UI (work-plan Stage 2).
#[derive(Debug, Clone, Serialize)]
pub struct SessionSummary {
    pub id: String,
    pub filename: String,
    pub entry_path: String,
}

#[derive(Debug, Serialize)]
pub struct OpenDocumentResult {
    pub session: SessionSummary,
}

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error(transparent)]
    OpenRequest(#[from] OpenRequestError),
    #[error(transparent)]
    Compiler(#[from] CompileError),
    #[error("no active session")]
    NoActiveSession,
    #[error("requested session is not the active session")]
    NotActiveSession,
    #[error("session id is invalid: {0}")]
    InvalidSessionId(String),
    #[error("lock poisoned")]
    LockPoisoned,
}

impl Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<CompileError> for CommandError {
    fn from(e: CompileError) -> Self {
        // Surface the compiler diagnostic without leaking internals beyond the
        // message; the frontend shows it as a controlled error.
        CommandError::Compiler(e)
    }
}

fn parse_session_id(raw: &str) -> Result<SessionId, CommandError> {
    SessionId::new(raw.to_string()).map_err(|_| CommandError::InvalidSessionId(raw.to_string()))
}

/// Opens a `.typ` chosen through the native file dialog.
///
/// Returns the new session summary, or `None` if the dialog was cancelled.
#[tauri::command]
pub fn open_document_dialog(
    app: tauri::AppHandle,
) -> Result<Option<OpenDocumentResult>, CommandError> {
    let picked = tauri_plugin_dialog::blocking::FileDialogBuilder::new()
        .add_filter("Typst", &["typ"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    let normalized = OpenRequestRouter::validate(&path)?;
    let summary = register_session(app, normalized)?;
    Ok(Some(OpenDocumentResult { session: summary }))
}

/// Opens a `.typ` from a path string (drag/drop, argv, Open With, forwarding).
#[tauri::command]
pub fn open_document(
    path: String,
    app: tauri::AppHandle,
) -> Result<OpenDocumentResult, CommandError> {
    let normalized = OpenRequestRouter::normalize(&path)?;
    let summary = register_session(app, normalized)?;
    Ok(OpenDocumentResult { session: summary })
}

/// Closes the given session if it is the active one.
#[tauri::command]
pub fn close_document(session_id: String, app: tauri::AppHandle) -> Result<(), CommandError> {
    let id = parse_session_id(&session_id)?;
    let state = app.state::<AppState>();
    let mut manager = state
        .session_manager
        .lock()
        .map_err(|_| CommandError::LockPoisoned)?;
    match manager.close(&id) {
        Ok(()) => {
            // Tear down the candidate watcher and revisions for the closed session.
            let state = app.state::<AppState>();
            if let Ok(mut guard) = state.candidate_watcher.lock() {
                *guard = None;
            }
            if let Ok(mut reg) = state.revision_registry.lock() {
                reg.remove(&id);
            }
            Ok(())
        }
        Err(CloseError::NoActiveSession) => Err(CommandError::NoActiveSession),
        Err(CloseError::NotActive) => Err(CommandError::NotActiveSession),
    }
}

/// Returns the active session summary, if any.
#[tauri::command]
pub fn get_active_session(app: tauri::AppHandle) -> Result<Option<SessionSummary>, CommandError> {
    let state = app.state::<AppState>();
    let manager = state
        .session_manager
        .lock()
        .map_err(|_| CommandError::LockPoisoned)?;
    Ok(manager.get_active().map(summarize))
}

/// Compiles the active session once with the bundled Typst sidecar.
///
/// Writes `candidate.pdf` into the session cache dir and returns the outcome,
/// including any bounded diagnostic. The frontend must not call this with a
/// stale `session_id`; the backend verifies the id matches the active session.
#[tauri::command]
pub fn compile_document(
    session_id: String,
    app: tauri::AppHandle,
) -> Result<CompileOutcome, CommandError> {
    let id = parse_session_id(&session_id)?;
    crate::compiler::CompilerService::compile_once(&app, &id).map_err(CommandError::from)
}

/// Registers a validated entry path as a new active session.
fn register_session(
    app: tauri::AppHandle,
    entry_path: std::path::PathBuf,
) -> Result<SessionSummary, CommandError> {
    let state = app.state::<AppState>();
    let cache_root = state.cache_root.clone();
    let mut manager = state
        .session_manager
        .lock()
        .map_err(|_| CommandError::LockPoisoned)?;
    let id = manager.open(entry_path, &cache_root)?;
    // Re-fetch the session to summarize (manager owns it now).
    let session = manager
        .get_active()
        .filter(|s| s.id == id)
        .cloned()
        .ok_or(CommandError::NoActiveSession)?;
    drop(manager);

    // Replace any prior watcher and start a candidate watcher for the new session
    // (architecture §12.1b). The previous session's watcher is dropped here.
    let watcher = crate::preview::output_watch::start_candidate_watcher(
        app.clone(),
        id.clone(),
        session.cache_dir.clone(),
        "candidate.pdf",
    );
    {
        let mut guard = state
            .candidate_watcher
            .lock()
            .map_err(|_| CommandError::LockPoisoned)?;
        *guard = watcher.ok();
    }
    // Drop stale revisions from any previous session.
    if let Ok(mut reg) = state.revision_registry.lock() {
        reg.remove(&id);
    }

    Ok(summarize(&session))
}

fn summarize(session: &crate::session::DocumentSession) -> SessionSummary {
    let filename = session
        .entry_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.typ")
        .to_string();
    SessionSummary {
        id: session.id.as_str().to_string(),
        filename,
        entry_path: session.entry_path.to_string_lossy().to_string(),
    }
}
