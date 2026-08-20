//! Candidate watcher: turns Typst's `candidate.pdf` into immutable revisions.
//!
//! Watches the session cache directory non-recursively (architecture §12.1b).
//! Any event is only a hint; after debouncing we perform a stable read + PDF
//! sanity check and, if good, commit a new immutable revision and emit
//! `preview-updated` (see `delivery.rs`). This stage wires only the *candidate*
//! watcher; source watching arrives in Stage 6/10.

use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::time::Duration;

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Manager};

use super::delivery;
use super::revisions::{looks_like_pdf, read_stable_candidate, RevisionError};
use crate::app_state::AppState;
use crate::session::SessionId;

/// Debounce window for coalescing rapid candidate writes.
const DEBOUNCE: Duration = Duration::from_millis(120);

/// Starts watching `cache_dir` for `candidate.pdf` changes for `session_id`.
///
/// Returns the `RecommendedWatcher` so the caller (session owner) keeps it alive
/// for the session's lifetime; dropping it stops watching. All logic runs on a
/// background thread that talks back to the app via the `AppHandle`.
pub fn start_candidate_watcher(
    app: AppHandle,
    session_id: SessionId,
    cache_dir: PathBuf,
    candidate_name: &str,
) -> notify::Result<RecommendedWatcher> {
    let (tx, rx) = channel::<Event>();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(ev) = res {
                let _ = tx.send(ev);
            }
        },
        notify::Config::default(),
    )?;

    watcher.watch(&cache_dir, RecursiveMode::NonRecursive)?;

    let worker_app = app.clone();
    let candidate_file = candidate_name.to_string();
    std::thread::spawn(move || {
        let mut pending = false;
        loop {
            match rx.recv() {
                Ok(event) => {
                    if event_is_relevant(&event, &candidate_file) {
                        pending = true;
                    }
                }
                Err(_) => break,
            }
            loop {
                match rx.recv_timeout(DEBOUNCE) {
                    Ok(event) => {
                        if event_is_relevant(&event, &candidate_file) {
                            pending = true;
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return,
                }
            }
            if pending {
                pending = false;
                commit_once(&worker_app, &session_id, &cache_dir, &candidate_file);
            }
        }
    });

    Ok(watcher)
}

fn event_is_relevant(event: &Event, candidate_file: &str) -> bool {
    event
        .paths
        .iter()
        .any(|p| p.file_name().map(|n| n == candidate_file).unwrap_or(false))
}

/// One commit attempt: verify active session, stable-read candidate, sanity
/// check, then commit + emit. Failures are logged, never panicked.
///
/// `cache_dir` is the session's own cache dir (already root-bounded); the
/// committed revision is written there.
fn commit_once(app: &AppHandle, session_id: &SessionId, cache_dir: &Path, candidate_name: &str) {
    {
        let state = app.state::<AppState>();
        let manager = match state.session_manager.lock() {
            Ok(m) => m,
            Err(_) => return,
        };
        if manager.active_id() != Some(session_id) {
            return; // stale session: ignore the hint
        }
    }

    let candidate_path = cache_dir.join(candidate_name);
    let bytes = match read_stable_candidate(&candidate_path) {
        Ok(b) => b,
        Err(RevisionError::Read(_)) | Err(RevisionError::Empty) => return, // not ready yet
        Err(e) => {
            log::warn!("candidate read skipped: {e}");
            return;
        }
    };
    if !looks_like_pdf(&bytes) {
        log::warn!("candidate rejected: not a valid PDF snapshot");
        // Typst failed to produce a valid PDF (e.g. invalid source); keep the
        // last-good revision displayed and surface an Error state.
        crate::compiler::diagnostic::set_compile_state(
            app,
            session_id,
            crate::compiler::diagnostic::CompileState::Error {
                message: "Typst did not produce a valid PDF".to_string(),
                last_good_revision: None,
            },
        );
        return;
    }

    let state = app.state::<AppState>();
    let revision = {
        let mut registry = match state.revision_registry.lock() {
            Ok(r) => r,
            Err(_) => return,
        };
        match registry
            .store_mut(session_id)
            .commit(session_id, cache_dir, &bytes)
        {
            Ok(r) => r,
            Err(e) => {
                log::warn!("revision commit failed: {e}");
                return;
            }
        }
    };
    delivery::emit_preview_updated(app, session_id, revision.number);
    // Successful commit ⇒ Ready with the new revision (last-good advances).
    crate::compiler::diagnostic::set_compile_state(
        app,
        session_id,
        crate::compiler::diagnostic::CompileState::Ready {
            revision: revision.number,
        },
    );
}
