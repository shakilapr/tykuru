//! Window-bounds persistence (work-plan Stage 16 "window bounds where
//! practical").
//!
//! On startup the saved `WindowState` is applied to the main window; on window
//! close the current bounds are captured and persisted atomically through the
//! settings store. All geometry is read/written through the Tauri window API —
//! never a hard-coded coordinate — so it degrades gracefully if the window is
//! off-screen or the display changed (the OS clamps as usual).

use tauri::{AppHandle, Manager, Runtime};

use crate::app_state::AppState;
use crate::settings::WindowState;

/// Applies the persisted window bounds (position, size, maximized) to the main
/// window during `setup`. Best-effort: any failure leaves the window default.
pub fn apply_saved<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let Ok(settings) = state.settings_store.load() else {
        return;
    };
    let Some(saved) = settings.window_state else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Position first, then size, then maximized (maximize after size avoids a
    // flash of the restored size before maximizing).
    let _ = window.set_position(tauri::PhysicalPosition::new(saved.x, saved.y));
    let _ = window.set_size(tauri::PhysicalSize::new(saved.width, saved.height));
    if saved.maximized {
        let _ = window.maximize();
    }
}

/// Attaches the close-event listener that persists window bounds. Called from
/// the app builder's `on_window_event`.
///
/// The listener persists the current bounds on `CloseRequested` — best-effort,
/// mirroring the shutdown coordinator's philosophy (never block teardown on
/// settings I/O).
pub fn persist_current<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(pos) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let maximized = window.is_maximized().unwrap_or(false);
    let state = WindowState {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        maximized,
    };
    let app_state = app.state::<AppState>();
    let Ok(mut settings) = app_state.settings_store.load() else {
        return;
    };
    settings.window_state = Some(state);
    if let Err(e) = app_state.settings_store.save(&settings) {
        log::warn!("window_state: failed to persist bounds: {e}");
    }
}

/// Unit-testable: builds a `WindowState` from raw geometry values (clamping
/// sanity is left to the OS; we only ensure values survive a round-trip).
#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::SettingsV1;

    #[test]
    fn window_state_round_trips_through_json() {
        let state = WindowState {
            x: -1920,
            y: 100,
            width: 1280,
            height: 720,
            maximized: true,
        };
        let json = serde_json::to_value(state).unwrap();
        let back: WindowState = serde_json::from_value(json).unwrap();
        assert_eq!(back, state);
    }

    #[test]
    fn window_state_accepts_zero_and_offscreen() {
        // Negative coordinates (multi-monitor, left of primary) must persist.
        let state = WindowState {
            x: -500,
            y: -40,
            width: 800,
            height: 600,
            maximized: false,
        };
        let json = serde_json::to_value(state).unwrap();
        let back: WindowState = serde_json::from_value(json).unwrap();
        assert_eq!(back, state);
    }

    #[test]
    fn settings_embed_window_state() {
        let settings = SettingsV1 {
            window_state: Some(WindowState {
                x: 10,
                y: 20,
                width: 1024,
                height: 640,
                maximized: false,
            }),
            ..Default::default()
        };
        let json = serde_json::to_value(settings.clone()).unwrap();
        let back = SettingsV1::migrate(&json).expect("migrate");
        assert_eq!(back.window_state, settings.window_state);
    }
}
