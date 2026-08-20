//! Preview delivery command (narrow, identity-addressed).

use tauri::ipc::Response;
use tauri::AppHandle;

use crate::preview::delivery::{get_preview_pdf, DeliveryError};
use crate::session::SessionId;

/// Returns the bytes of a published preview revision as a binary IPC response.
///
/// Addresses the file only by `session_id` + `revision`; never accepts a path
/// from the frontend (architecture §13). Unknown session/revision is rejected.
#[tauri::command]
pub fn get_preview_pdf_command(
    session_id: String,
    revision: u64,
    app: AppHandle,
) -> Result<Response, String> {
    let id = SessionId::new(session_id).map_err(|e| e.to_string())?;
    let bytes = get_preview_pdf(&app, &id, revision).map_err(|e: DeliveryError| e.to_string())?;
    Ok(Response::new(bytes))
}
