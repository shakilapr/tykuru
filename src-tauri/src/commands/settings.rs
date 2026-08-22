//! Settings Tauri commands (architecture §18, §20).
//!
//! `get_settings` returns the current persisted settings; `update_settings`
//! applies a validated, bounded patch and persists atomically. The frontend
//! never writes the settings file directly — it only calls these narrow,
//! typed commands.

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::app_state::AppState;
use crate::settings::{SettingsV1, Theme};

#[derive(Debug, thiserror::Error)]
pub enum SettingsCommandError {
    #[error("lock poisoned")]
    LockPoisoned,
    #[error(transparent)]
    Store(#[from] crate::settings::StoreError),
}

impl Serialize for SettingsCommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Partial update accepted by `update_settings`. Only fields present in the
/// patch are changed; everything else is preserved. All values are validated
/// (bounded) before persisting.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SettingsPatch {
    pub theme: Option<Theme>,
    pub editor_visible: Option<bool>,
    pub split_ratio: Option<f64>,
    /// Push-to-front replacement for the recent files list (pruned + capped).
    pub recent_files: Option<Vec<String>>,
    /// Root overrides keyed by canonical entry path.
    pub root_overrides: Option<std::collections::HashMap<String, String>>,
    pub window_state: Option<crate::settings::WindowState>,
}

fn bounded_split_ratio(v: f64) -> f64 {
    // 0.05..0.95; clamps rather than rejects (architecture §19 layout safety).
    if v.is_nan() {
        return 0.5;
    }
    let clamped = v.clamp(0.05, 0.95);
    (clamped * 100.0).round() / 100.0
}

fn apply_patch(mut settings: SettingsV1, patch: SettingsPatch) -> SettingsV1 {
    if let Some(theme) = patch.theme {
        settings.theme = theme;
    }
    if let Some(v) = patch.editor_visible {
        settings.editor_visible = v;
    }
    if let Some(v) = patch.split_ratio {
        settings.split_ratio = bounded_split_ratio(v);
    }
    if let Some(files) = patch.recent_files {
        let mut list = crate::settings::BoundedRecentFiles::default();
        for f in files {
            if !f.trim().is_empty() {
                list.push(std::path::PathBuf::from(f));
            }
        }
        list.prune_missing();
        settings.recent_files = list;
    }
    if let Some(overrides) = patch.root_overrides {
        settings.root_overrides = overrides
            .into_iter()
            .filter(|(k, v)| !k.is_empty() && !v.is_empty())
            .map(|(k, v)| (std::path::PathBuf::from(k), std::path::PathBuf::from(v)))
            .collect();
    }
    if let Some(state) = patch.window_state {
        settings.window_state = Some(state);
    }
    settings
}

/// Returns the current persisted settings.
#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<SettingsV1, SettingsCommandError> {
    let state = app.state::<AppState>();
    state.settings_store.load().map_err(Into::into)
}

/// Applies a validated patch and persists atomically. Returns the new settings.
#[tauri::command]
pub fn update_settings(
    patch: SettingsPatch,
    app: tauri::AppHandle,
) -> Result<SettingsV1, SettingsCommandError> {
    let state = app.state::<AppState>();
    let current = state
        .settings_store
        .load()
        .map_err(SettingsCommandError::Store)?;
    let next = apply_patch(current, patch);
    state
        .settings_store
        .save(&next)
        .map_err(SettingsCommandError::Store)?;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{BoundedRecentFiles, RootOverrideMap};

    #[test]
    fn patch_preserves_unset_fields() {
        let base = SettingsV1 {
            theme: Theme::Dark,
            editor_visible: true,
            ..Default::default()
        };
        let patch = SettingsPatch {
            split_ratio: Some(0.3),
            ..Default::default()
        };
        let out = apply_patch(base.clone(), patch);
        assert_eq!(out.theme, Theme::Dark);
        assert!(out.editor_visible);
        assert_eq!(out.split_ratio, 0.3);
    }

    #[test]
    fn split_ratio_is_bounded_and_rounded() {
        let base = SettingsV1::default();
        assert_eq!(
            apply_patch(
                base.clone(),
                SettingsPatch {
                    split_ratio: Some(2.0),
                    ..Default::default()
                }
            )
            .split_ratio,
            0.95
        );
        assert_eq!(
            apply_patch(
                base.clone(),
                SettingsPatch {
                    split_ratio: Some(-1.0),
                    ..Default::default()
                }
            )
            .split_ratio,
            0.05
        );
        assert_eq!(
            apply_patch(
                base.clone(),
                SettingsPatch {
                    split_ratio: Some(f64::NAN),
                    ..Default::default()
                }
            )
            .split_ratio,
            0.5
        );
        assert_eq!(
            apply_patch(
                base,
                SettingsPatch {
                    split_ratio: Some(0.66666),
                    ..Default::default()
                }
            )
            .split_ratio,
            0.67
        );
    }

    #[test]
    fn recent_files_are_capped_and_pruned() {
        let base = SettingsV1::default();
        let files: Vec<String> = (0..15).map(|i| format!("C:\\docs\\f{i}.typ")).collect();
        let out = apply_patch(
            base,
            SettingsPatch {
                recent_files: Some(files),
                ..Default::default()
            },
        );
        assert_eq!(out.recent_files.files.len(), BoundedRecentFiles::MAX_FILES);
        // prune_missing removes nonexistent temp paths; with none existing,
        // the list becomes empty (missing files are never surfaced).
        assert!(out.recent_files.files.is_empty());
    }

    #[test]
    fn root_overrides_are_filtered_for_empty() {
        let base = SettingsV1::default();
        let mut map = RootOverrideMap::default();
        map.insert("C:\\a\\b.typ".into(), "C:\\a".into());
        let mut raw = std::collections::HashMap::new();
        raw.insert("C:\\a\\b.typ".to_string(), "C:\\a".to_string());
        raw.insert("".to_string(), "x".to_string());
        let out = apply_patch(
            base,
            SettingsPatch {
                root_overrides: Some(raw),
                ..Default::default()
            },
        );
        assert_eq!(out.root_overrides, map);
    }
}
