//! Tykuru backend entry point.

mod app_state;
mod commands;
mod open_request;
mod session;

use app_state::AppState;

/// Builds the Tauri application, registers plugins, and runs the event loop.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::document::open_document_dialog,
            commands::document::open_document,
            commands::document::close_document,
            commands::document::get_active_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tykuru");
}
