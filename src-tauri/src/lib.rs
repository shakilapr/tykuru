//! Tykuru backend entry point.

pub mod app_state;
pub mod commands;
pub mod compiler;
pub mod open_request;
pub mod preview;
pub mod session;
pub mod shutdown;
pub mod source;

use app_state::AppState;

/// Builds the Tauri application, registers plugins, and runs the event loop.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::document::open_document_dialog,
            commands::document::open_document,
            commands::document::close_document,
            commands::document::get_active_session,
            commands::document::compile_document,
            commands::preview::get_preview_pdf_command,
            commands::editor::read_source_command,
            commands::editor::save_source_command,
            commands::editor::resolve_source_conflict_keep_local_command,
        ])
        .setup(|app| {
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
