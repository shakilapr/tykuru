//! Integration tests for the bundled Typst one-shot compile (Stage 3).
//!
//! These run against the real sidecar binary resolved from `tauri.conf.json`
//! `bundle.externalBin`. They require `config/versions.toml` to match the
//! sidecar on disk (enforced by `scripts/verify_typst.ps1` in CI).

use std::path::PathBuf;

use tauri::test::{mock_builder, MockRuntime};
use tauri::Manager;
use tykuru_lib::compiler::CompilerService;
use tykuru_lib::session::{SessionId, SessionManager};

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

#[test]
fn valid_fixture_compiles_and_writes_candidate() {
    let app = build_app();
    let id = open(&app, "basic");

    let outcome = CompilerService::compile_once(&app, &id).expect("compile_once");
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

    // The project directory must not receive a generated preview PDF.
    let proj_pdf = fixture("basic").parent().unwrap().join("main.pdf");
    assert!(!proj_pdf.exists(), "sidecar leaked PDF into project dir");
}

#[test]
fn invalid_fixture_fails_with_diagnostic() {
    let app = build_app();
    let id = open(&app, "errors");

    let outcome = CompilerService::compile_once(&app, &id).expect("compile_once");
    assert!(!outcome.success, "expected failure for errors fixture");
    assert!(!outcome.stderr.is_empty(), "diagnostic should be captured");
    assert!(outcome.exit_code.is_some());
}

#[test]
fn compile_rejects_stale_session_id() {
    let app = build_app();
    let _id = open(&app, "basic");
    let stale = SessionId::generate();
    let result = CompilerService::compile_once(&app, &stale);
    assert!(result.is_err(), "stale session id must be rejected");
}

// Keep the unused import warning quiet on configurations where MockRuntime is
// only referenced via the builder.
#[allow(dead_code)]
fn _assert_runtime() -> Option<MockRuntime> {
    None
}
