//! Integration tests for the bundled Typst compiler (Stage 3 + Stage 6).
//!
//! These run against the real sidecar binary resolved from `tauri.conf.json`
//! `bundle.externalBin`. They require `config/versions.toml` to match the
//! sidecar on disk (enforced by `scripts/verify_typst.ps1` in CI).

use std::path::PathBuf;
use std::time::Duration;

use tauri::test::mock_builder;
use tauri::Manager;
use tykuru_lib::compiler::{compile_once, start_watch, stop_watch};
use tykuru_lib::session::SessionId;

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("fixtures")
        .join(name)
        .join("main.typ")
}

fn build_app() -> tauri::AppHandle {
    let app = mock_builder()
        .plugin(tauri_plugin_shell::init())
        .manage(tykuru_lib::app_state::AppState::default())
        .build(tauri::generate_context!())
        .expect("mock app");
    app.handle().clone()
}

fn open(app: &tauri::AppHandle, fixture_name: &str) -> SessionId {
    let entry = fixture(fixture_name);
    let state = app.state::<tykuru_lib::app_state::AppState>();
    let cache_root = state.cache_root.clone();
    let mut manager = state.session_manager.lock().unwrap();
    manager.open(entry, &cache_root).expect("open session")
}

/// Waits until the session has published at least `min` revisions.
fn wait_for_revisions(app: &tauri::AppHandle, session_id: &SessionId, min: u64) {
    let state = app.state::<tykuru_lib::app_state::AppState>();
    for _ in 0..100 {
        if let Some(store) = state.revision_registry.lock().unwrap().store(session_id) {
            if store.current().unwrap_or(0) + 1 >= min {
                return;
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn valid_fixture_compiles_and_writes_candidate() {
    let app = build_app();
    let id = open(&app, "basic");

    let outcome = compile_once(&app, &id).expect("compile_once");
    assert!(outcome.success, "stderr: {}", outcome.stderr);

    let state = app.state::<tykuru_lib::app_state::AppState>();
    let manager = state.session_manager.lock().unwrap();
    let session = manager.get_active().expect("active");
    let candidate = session.cache_dir.join("candidate.pdf");
    assert!(candidate.exists(), "candidate missing at {candidate:?}");

    let bytes = std::fs::read(&candidate).expect("read candidate");
    assert!(
        bytes.len() > 1024,
        "candidate too small: {} bytes",
        bytes.len()
    );
    assert_eq!(&bytes[..5], b"%PDF-", "not a PDF");
}

#[test]
fn invalid_fixture_fails_with_diagnostic() {
    let app = build_app();
    let id = open(&app, "errors");

    let outcome = compile_once(&app, &id).expect("compile_once");
    assert!(!outcome.success, "expected failure for errors fixture");
    assert!(!outcome.stderr.is_empty(), "diagnostic should be captured");
    assert!(outcome.exit_code.is_some());
}

#[test]
fn compile_rejects_stale_session_id() {
    let app = build_app();
    let _id = open(&app, "basic");
    let stale = SessionId::generate();
    assert!(
        compile_once(&app, &stale).is_err(),
        "stale session id must be rejected"
    );
}

#[test]
fn watch_publishes_revisions_and_stops_child() {
    let app = build_app();
    let id = open(&app, "basic");

    start_watch(&app, &id).expect("start watch");
    // A watcher is now running; a second start must be refused (§8.2).
    assert!(
        start_watch(&app, &id).is_err(),
        "duplicate watcher must be rejected"
    );

    wait_for_revisions(&app, &id, 1);
    let before = app
        .state::<tykuru_lib::app_state::AppState>()
        .revision_registry
        .lock()
        .unwrap()
        .store(&id)
        .and_then(|s| s.current())
        .unwrap_or(0);

    // Stop the watcher; the child process must exit.
    stop_watch(&app).expect("stop watch");
    assert!(
        !app.state::<tykuru_lib::app_state::AppState>()
            .compiler_manager
            .is_running(),
        "watcher should not be running after stop"
    );
    assert!(before >= 1, "expected at least one revision from the watch");
}

#[test]
fn watch_recovers_from_stale_session_publish() {
    let app = build_app();
    let id_a = open(&app, "basic");
    start_watch(&app, &id_a).expect("start watch A");
    wait_for_revisions(&app, &id_a, 1);
    // Open a new session: previous watcher is stopped on close, new one starts.
    let id_b = open(&app, "unicode");
    stop_watch(&app).expect("stop A's watcher");
    start_watch(&app, &id_b).expect("start watch B");
    wait_for_revisions(&app, &id_b, 1);
    assert!(app
        .state::<tykuru_lib::app_state::AppState>()
        .compiler_manager
        .is_running());
    stop_watch(&app).expect("stop B's watcher");
}
