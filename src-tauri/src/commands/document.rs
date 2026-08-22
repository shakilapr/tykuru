//! Tauri commands for document/session lifecycle.
//!
//! These are the narrow, typed surface the frontend may call (architecture §20).
//! They never expose generic filesystem/process access; all validation and
//! session ownership lives in `OpenRequestRouter` and `SessionManager`.

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::app_state::AppState;
use crate::compiler::{CompileError, CompileOutcome, CompilerError};
use crate::open_request::{OpenRequestError, OpenRequestRouter};
use crate::session::{CloseError, ProjectRootService, RootError, SessionId};

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
    Session(#[from] crate::session::SessionError),
    #[error(transparent)]
    Compiler(#[from] CompileError),
    #[error(transparent)]
    Watch(#[from] CompilerError),
    #[error(transparent)]
    SourceRead(#[from] crate::source::SourceReadError),
    #[error(transparent)]
    SourceWrite(#[from] crate::source::SourceWriteError),
    #[error("no active session")]
    NoActiveSession,
    #[error("requested session is not the active session")]
    NotActiveSession,
    #[error("session id is invalid: {0}")]
    InvalidSessionId(String),
    #[error(transparent)]
    Root(#[from] RootError),
    #[error(transparent)]
    Close(#[from] CloseError),
    #[error("lock poisoned")]
    LockPoisoned,
}

impl Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
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
    let picked = app
        .dialog()
        .file()
        .add_filter("Typst", &["typ"])
        .blocking_pick_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    // `blocking_pick_file` returns a `FilePath`; for a file dialog the platform
    // path variant is expected. Fall back to rejecting on parse failure rather
    // than inventing a path.
    let path = file_path
        .as_path()
        .ok_or(CommandError::OpenRequest(OpenRequestError::NotAFile))?
        .to_path_buf();
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
            // Tear down the compiler watcher, candidate watcher, source watcher,
            // and registries for the closed session (architecture §8.2).
            if let Err(e) = crate::compiler::stop_watch(&app) {
                log::warn!("close: failed to stop compiler watcher: {e}");
            }
            let state = app.state::<AppState>();
            if let Ok(mut guard) = state.candidate_watcher.lock() {
                *guard = None;
            }
            if let Ok(mut guard) = state.source_watcher.lock() {
                *guard = None;
            }
            if let Ok(mut reg) = state.revision_registry.lock() {
                reg.remove(&id);
            }
            if let Ok(mut reg) = state.source_revision_registry.lock() {
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
pub async fn compile_document(
    session_id: String,
    app: tauri::AppHandle,
) -> Result<CompileOutcome, CommandError> {
    let id = parse_session_id(&session_id)?;
    Ok(crate::compiler::sidecar::compile_once(&app, &id).await?)
}

/// Changes the project root for the active session and restarts the watcher
/// with the new `--root` so imported files outside the entry's directory
/// resolve correctly (architecture §10, Stage 14).
///
/// The running `typst watch` is stopped first, then restarted with the new
/// root. The last-good preview revision stays visible while the restart
/// happens; only a successful recompile replaces it.
#[tauri::command]
pub fn set_project_root(
    session_id: String,
    root: String,
    app: tauri::AppHandle,
) -> Result<(), CommandError> {
    let id = parse_session_id(&session_id)?;
    let root_path = std::path::PathBuf::from(&root);

    let state = app.state::<AppState>();
    let (canonical, entry_path) = {
        let mut manager = state
            .session_manager
            .lock()
            .map_err(|_| CommandError::LockPoisoned)?;

        // Validate the root against the active session only.
        let mut active = manager
            .get_active()
            .filter(|s| s.id == id)
            .cloned()
            .ok_or(CommandError::NoActiveSession)?;
        let canonical = ProjectRootService::set_root(&mut active, &root_path)?;
        let entry_path = active.entry_path.clone();

        // Persist the root change onto the manager's stored session, then
        // restart the watcher so it picks up the new `--root` (sidecar re-reads
        // `session.project_root` on start). The session_manager lock is released
        // before restarting because `start_watch` re-locks it (sidecar.rs).
        manager.update_root(&id, canonical.clone())?;
        (canonical, entry_path)
    };

    // Persist the override keyed by canonical entry path (§10). Reads the
    // current settings, updates the map, saves atomically. A settings I/O
    // failure is non-fatal: the live session already has the new root.
    if let Ok(mut settings) = state.settings_store.load() {
        settings.root_overrides.insert(entry_path, canonical);
        if let Err(e) = state.settings_store.save(&settings) {
            log::warn!("set_project_root: failed to persist override: {e}");
        }
    }

    // Stop then restart the watcher. `stop` waits for the child to exit, so no
    // duplicate watcher can remain (architecture §8.2).
    if let Err(e) = crate::compiler::stop_watch(&app) {
        log::warn!("set_project_root: failed to stop watcher: {e}");
    }
    crate::compiler::start_watch(&app, &id)?;
    Ok(())
}

/// Opens the native folder picker and applies the chosen project root.
///
/// Returns `None` if the dialog was cancelled, matching the open-dialog
/// convention. Native dialog logic stays in the backend (architecture §6.1).
#[tauri::command]
pub fn set_project_root_dialog(
    session_id: String,
    app: tauri::AppHandle,
) -> Result<Option<()>, CommandError> {
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(folder_path) = picked else {
        return Ok(None);
    };
    let root = folder_path
        .as_path()
        .ok_or(CommandError::OpenRequest(OpenRequestError::NotAFile))?
        .to_path_buf();
    set_project_root(session_id, root.to_string_lossy().into_owned(), app)?;
    Ok(Some(()))
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
    // Re-apply a persisted project-root override keyed by canonical entry path
    // (§10, Stage 14 persistence via SettingsV1.root_overrides). Falls back to
    // the default `parent(entry)` when no override exists.
    if let Ok(settings) = state.settings_store.load() {
        if let Some(root) = settings.root_overrides.get(&session.entry_path) {
            let _ = manager.update_root(&id, root.clone());
        }
    }
    drop(manager);

    // Push the opened entry onto the bounded recent-files list and persist
    // (§18). Best-effort: a settings I/O failure must not fail the open.
    if let Ok(mut settings) = state.settings_store.load() {
        settings.recent_files.push(session.entry_path.clone());
        settings.recent_files.prune_missing();
        if let Err(e) = state.settings_store.save(&settings) {
            log::warn!("register_session: failed to persist recent file: {e}");
        }
    }

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
    // Start the entry-file source watcher for editor synchronization (§12.1b,
    // §16). Dropped on close/open like the candidate watcher.
    let source_watcher = crate::source::external_watch::start_source_watcher(
        app.clone(),
        id.clone(),
        session.entry_path.clone(),
    );
    {
        let mut guard = state
            .source_watcher
            .lock()
            .map_err(|_| CommandError::LockPoisoned)?;
        *guard = source_watcher.ok();
    }
    // Start the live `typst watch` so source changes refresh the preview
    // (Stage 6). The watcher writes candidate.pdf; the candidate watcher turns
    // it into immutable revisions.
    crate::compiler::start_watch(&app, &id)?;
    // Drop stale revisions from any previous session.
    if let Ok(mut reg) = state.revision_registry.lock() {
        reg.remove(&id);
    }
    if let Ok(mut reg) = state.source_revision_registry.lock() {
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
