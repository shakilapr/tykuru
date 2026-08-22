//! Source watcher: turns entry-file changes into editor synchronization.
//!
//! Watches `parent(entry.typ)` non-recursively and filters events for the entry
//! file name (architecture §12.1b). Any event is only a hint; after debouncing
//! we re-read the file, classify the new `DiskRevision` against the ledger
//! (`classify_change`, §15.3), and emit `source-changed(sessionId, revision)`
//! only for genuine external changes. The watcher never tracks Typst
//! dependencies — that is `typst watch`'s job (§16.1).

use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::app_state::AppState;
use crate::session::SessionId;
use crate::source::sync::{classify_change, ChangeKind};
use crate::source::write::DiskRevision;

/// Debounce window for coalescing rapid external saves.
const DEBOUNCE: Duration = Duration::from_millis(150);

/// Starts watching `entry_path`'s parent directory for external edits.
///
/// Returns the `RecommendedWatcher` so the caller (session owner) keeps it alive
/// for the session's lifetime; dropping it stops watching. All logic runs on a
/// background thread that talks back to the app via the `AppHandle`.
pub fn start_source_watcher<R: Runtime>(
    app: AppHandle<R>,
    session_id: SessionId,
    entry_path: PathBuf,
) -> notify::Result<RecommendedWatcher> {
    let parent = entry_path
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    let entry_name = entry_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let (tx, rx) = channel::<Event>();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(ev) = res {
                let _ = tx.send(ev);
            }
        },
        notify::Config::default(),
    )?;

    watcher.watch(&parent, RecursiveMode::NonRecursive)?;

    let worker_app = app.clone();
    std::thread::spawn(move || {
        let mut pending = false;
        while let Ok(event) = rx.recv() {
            if event_is_relevant(&event, &entry_name) {
                pending = true;
            }
            loop {
                match rx.recv_timeout(DEBOUNCE) {
                    Ok(event) => {
                        if event_is_relevant(&event, &entry_name) {
                            pending = true;
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return,
                }
            }
            if pending {
                pending = false;
                on_change(&worker_app, &session_id, &entry_path);
            }
        }
    });

    Ok(watcher)
}

fn event_is_relevant(event: &Event, entry_name: &str) -> bool {
    event
        .paths
        .iter()
        .any(|p| p.file_name().map(|n| n == entry_name).unwrap_or(false))
}

/// One reconciliation attempt: verify active session, re-read, classify, and
/// emit `source-changed` for genuine external changes.
fn on_change<R: Runtime>(app: &AppHandle<R>, session_id: &SessionId, entry_path: &std::path::Path) {
    let state = app.state::<AppState>();
    // Stale session guard: late events from a closed/replaced session are
    // discarded (§8.3). The registry entry is removed on close, so a missing
    // entry here also means the session is gone.
    {
        let manager = match state.session_manager.lock() {
            Ok(m) => m,
            Err(_) => return,
        };
        if manager.active_id() != Some(session_id) {
            return;
        }
    }

    let current = match std::fs::read(entry_path) {
        Ok(bytes) => DiskRevision::compute(&bytes),
        Err(_) => return, // file temporarily unavailable (mid-save/rename)
    };

    let kind = {
        let mut reg = match state.source_revision_registry.lock() {
            Ok(r) => r,
            Err(_) => return,
        };
        let Some(s) = reg.state(session_id) else {
            return; // no ledger entry → session not tracked
        };
        let kind = classify_change(&current, &s.disk_revision, s.last_self_write.as_ref());
        if kind == ChangeKind::External || kind == ChangeKind::SelfWrite {
            reg.note_disk_revision(session_id, current.clone());
        }
        kind
    };

    if kind == ChangeKind::External {
        let _ = app.emit("source-changed", (session_id.as_str(), current.as_str()));
        log::debug!(
            "source-changed: session {} → revision {}",
            session_id.as_str(),
            current.as_str()
        );
    }
}
