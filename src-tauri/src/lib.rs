//! Tykuru backend entry point.

pub mod app_state;
pub mod commands;
pub mod compiler;
pub mod open_request;
pub mod preview;
pub mod session;
pub mod settings;
pub mod shutdown;
pub mod source;
pub mod window_state;

use app_state::AppState;
use tauri::Manager;

/// Builds the Tauri application, registers plugins, and runs the event loop.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // Single-instance: a second `tykuru.exe <file.typ>` launch is forwarded
        // to the running instance instead of spawning a new window (§9.2).
        // The callback runs on the first instance and receives the new process
        // argv; we parse it and route through the same open path as a CLI open.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = crate::open_request::parse_launch_args(argv) {
                let path_str = path.to_string_lossy().into_owned();
                let app_handle = app.clone();
                match crate::commands::document::open_document(path_str, app_handle) {
                    Ok(_) => log::info!("opened forwarded document from second instance"),
                    Err(e) => log::warn!("failed to open forwarded document: {e}"),
                }
            }
            // Restore the window if it was minimized/hidden.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::document::open_document_dialog,
            commands::document::open_document,
            commands::document::close_document,
            commands::document::get_active_session,
            commands::document::compile_document,
            commands::document::set_project_root,
            commands::document::set_project_root_dialog,
            commands::preview::get_preview_pdf_command,
            commands::editor::read_source_command,
            commands::editor::save_source_command,
            commands::editor::resolve_source_conflict_keep_local_command,
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .setup(|app| {
            // Restore the saved window bounds, if any (Stage 16, §18). Best-effort.
            crate::window_state::apply_saved(app.handle());
            // Read launch args once; if a `.typ` path is present, open it after
            // the window exists (architecture §9, Stage 11). A missing/absent
            // document argument leaves the normal start screen unaffected.
            let args: Vec<String> = std::env::args().collect();
            if let Some(path) = crate::open_request::parse_launch_args(args) {
                let app_handle = app.handle().clone();
                let path_str = path.to_string_lossy().into_owned();
                match crate::commands::document::open_document(path_str, app_handle) {
                    Ok(_) => log::info!("opened document from launch args"),
                    Err(e) => log::warn!("failed to open document from launch args: {e}"),
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Persist the window bounds before teardown so the next launch
                // restores them (Stage 16, §18).
                crate::window_state::persist_current(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Tykuru")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Best-effort: stop the watcher so no `typst.exe` is orphaned.
                if let Err(e) = crate::shutdown::shutdown(app) {
                    log::warn!("shutdown: failed to stop compiler watcher: {e}");
                }
            }
        });
}
