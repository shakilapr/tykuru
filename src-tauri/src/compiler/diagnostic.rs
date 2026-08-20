//! Compile-state model and diagnostics (architecture §11.4, §12.3, §7.5).
//!
//! `typst watch` has no per-build exit, so Tykuru derives the UI state from
//! candidate-commit outcomes and a bounded stderr tail: a successful commit is
//! `Ready{revision}`; a rejected candidate or a typst stderr error is `Error`
//! with the `last_good_revision`. The displayed revision is never rolled back.

use std::collections::HashMap;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::app_state::AppState;
use crate::session::SessionId;

/// Bounded diagnostic text length (architecture §11.4).
const DIAGNOSTIC_LIMIT: usize = 4 * 1024;

/// UI-facing compile state for a session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum CompileState {
    Idle,
    Compiling,
    Ready {
        revision: u64,
    },
    Error {
        message: String,
        last_good_revision: Option<u64>,
    },
}

/// Updates the session's compile state and emits `compile-state-changed`.
///
/// `last_good_revision` is read from the revision registry so an `Error` never
/// rolls back the displayed document (architecture §12.3).
pub fn set_compile_state(app: &AppHandle, session_id: &SessionId, state: CompileState) {
    let last_good = match &state {
        CompileState::Error { .. } => {
            let reg = app.state::<AppState>().revision_registry.lock().ok();
            reg.and_then(|r| r.store(session_id))
                .and_then(|s| s.current())
        }
        _ => None,
    };
    let emitted = match &state {
        CompileState::Error { message, .. } => CompileState::Error {
            message: message.clone(),
            last_good_revision: last_good,
        },
        other => other.clone(),
    };

    {
        let state_map = &app.state::<AppState>().compile_states;
        if let Ok(mut map) = state_map.lock() {
            map.insert(session_id.clone(), emitted.clone());
        }
    }
    let _ = app.emit("compile-state-changed", (session_id.as_str(), emitted));
}

/// Reads a session's current compile state, if known.
pub fn get_compile_state(app: &AppHandle, session_id: &SessionId) -> Option<CompileState> {
    app.state::<AppState>()
        .compile_states
        .lock()
        .ok()
        .and_then(|m| m.get(session_id).cloned())
}

/// Bounds a diagnostic string to `DIAGNOSTIC_LIMIT` bytes (lossy).
pub fn bound_diagnostic(text: &str) -> String {
    if text.len() <= DIAGNOSTIC_LIMIT {
        text.to_string()
    } else {
        let tail = &text[text.len() - DIAGNOSTIC_LIMIT..];
        format!("…(truncated)\n{}", tail)
    }
}

/// Holds per-session compile states.
#[derive(Default)]
pub struct CompileStateRegistry {
    states: HashMap<SessionId, CompileState>,
}

impl CompileStateRegistry {
    pub fn insert(&mut self, id: SessionId, state: CompileState) {
        self.states.insert(id, state);
    }
    pub fn get(&self, id: &SessionId) -> Option<&CompileState> {
        self.states.get(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bound_diagnostic_truncates_long_text() {
        let long = "x".repeat(DIAGNOSTIC_LIMIT * 3);
        let out = bound_diagnostic(&long);
        assert!(out.len() <= DIAGNOSTIC_LIMIT + 32);
        assert!(out.contains("truncated"));
    }

    #[test]
    fn bound_diagnostic_keeps_short_text() {
        let short = "error: missing brace";
        assert_eq!(bound_diagnostic(short), short);
    }

    #[test]
    fn registry_stores_last_good_state() {
        let id = SessionId::generate();
        let mut reg = CompileStateRegistry::default();
        reg.insert(id.clone(), CompileState::Ready { revision: 3 });
        assert_eq!(reg.get(&id), Some(&CompileState::Ready { revision: 3 }));
        // An Error does not change the stored Ready here; the displayed revision
        // is resolved separately from the revision registry.
        reg.insert(
            id.clone(),
            CompileState::Error {
                message: "boom".into(),
                last_good_revision: Some(3),
            },
        );
        assert_eq!(
            reg.get(&id),
            Some(&CompileState::Error {
                message: "boom".into(),
                last_good_revision: Some(3)
            })
        );
    }
}
