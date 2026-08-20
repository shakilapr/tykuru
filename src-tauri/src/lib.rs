//! Tykuru backend entry point.

mod app_state;
mod commands;
mod compiler;
mod open_request;
mod preview;
mod session;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tykuru");
}
