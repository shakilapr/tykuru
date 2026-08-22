//! Settings model (architecture §18).
//!
//! Settings are small, strongly typed, and serialized as JSON. The versioned
//! `SettingsV1` struct gives an explicit migration point: `migrate()` runs on
//! load and advances older files to the current shape. Defaults are a safe
//! fallback — a missing or corrupt settings file never crashes the app.

use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Current settings schema version. Bump when the shape changes; `migrate()`
/// must handle every version below this.
pub const SETTINGS_VERSION: u32 = 1;

/// Light / dark / system theme selection (§7.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

/// Bounded recent-files list (cap ~10). Older entries beyond the cap are
/// dropped on insert. Paths are canonical entry paths for the document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct BoundedRecentFiles {
    pub files: Vec<PathBuf>,
}

impl BoundedRecentFiles {
    pub const MAX_FILES: usize = 10;

    /// Pushes `path` to the front (deduplicating) and truncates to the cap.
    pub fn push(&mut self, path: PathBuf) {
        self.files.retain(|p| p != &path);
        self.files.insert(0, path);
        self.files.truncate(Self::MAX_FILES);
    }

    /// Removes entries whose file no longer exists (missing files are pruned
    /// rather than surfaced to the user).
    pub fn prune_missing(&mut self) {
        self.files.retain(|p| p.is_file());
    }

    pub fn iter(&self) -> impl Iterator<Item = &PathBuf> {
        self.files.iter()
    }
}

/// Project-root override keyed by canonical entry path (§10, Stage 14). The
/// key is the canonicalized entry `.typ` path; the value is the chosen root.
pub type RootOverrideMap = HashMap<PathBuf, PathBuf>;

/// Serializable window geometry for bounds restore.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

/// The persisted application settings shape (version 1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SettingsV1 {
    pub version: u32,
    pub theme: Theme,
    pub editor_visible: bool,
    pub split_ratio: f64,
    pub recent_files: BoundedRecentFiles,
    pub root_overrides: RootOverrideMap,
    pub window_state: Option<WindowState>,
}

impl Default for SettingsV1 {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            theme: Theme::default(),
            editor_visible: false,
            split_ratio: 0.5,
            recent_files: BoundedRecentFiles::default(),
            root_overrides: RootOverrideMap::new(),
            window_state: None,
        }
    }
}

impl SettingsV1 {
    /// Migrates a parsed settings file to the current version.
    ///
    /// This is a pure function over the serialized shape. `json` must parse as
    /// a JSON object (older versions may have fewer fields). Returns the
    /// migrated `SettingsV1`, or `None` if the input is not parseable.
    pub fn migrate(json: &serde_json::Value) -> Option<Self> {
        // Start from defaults and overlay whatever fields survive. This is
        // forward-compatible with unknown fields and tolerant of missing ones.
        let mut settings = Self::default();
        let obj = json.as_object()?;

        // Version check: only handle version 1 today. Higher versions are
        // written by a newer build; refuse to silently downgrade.
        let version = obj.get("version").and_then(|v| v.as_u64()).unwrap_or(0);
        if version > SETTINGS_VERSION as u64 {
            return None;
        }

        if let Some(theme) = obj.get("theme").and_then(|v| v.as_str()) {
            settings.theme = match theme {
                "light" => Theme::Light,
                "dark" => Theme::Dark,
                _ => Theme::System,
            };
        }
        if let Some(v) = obj.get("editor_visible").and_then(|v| v.as_bool()) {
            settings.editor_visible = v;
        }
        if let Some(v) = obj.get("split_ratio").and_then(|v| v.as_f64()) {
            settings.split_ratio = (v * 100.0).round() / 100.0;
        }
        if let Some(files) = obj
            .get("recent_files")
            .and_then(|v| v.get("files"))
            .and_then(|v| v.as_array())
        {
            let mut list = BoundedRecentFiles::default();
            for f in files {
                if let Some(s) = f.as_str() {
                    list.push(PathBuf::from(s));
                }
            }
            settings.recent_files = list;
        }
        if let Some(overrides) = obj.get("root_overrides").and_then(|v| v.as_object()) {
            for (k, v) in overrides {
                if let Some(v) = v.as_str() {
                    settings
                        .root_overrides
                        .insert(PathBuf::from(k), PathBuf::from(v));
                }
            }
        }
        if let Some(win) = obj.get("window_state").and_then(|v| v.as_object()) {
            let read_i = |key: &str| win.get(key).and_then(|v| v.as_i64());
            let read_u = |key: &str| win.get(key).and_then(|v| v.as_u64());
            settings.window_state = Some(WindowState {
                x: read_i("x")? as i32,
                y: read_i("y")? as i32,
                width: read_u("width")? as u32,
                height: read_u("height")? as u32,
                maximized: win
                    .get("maximized")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
            });
        }
        settings.version = SETTINGS_VERSION;
        Some(settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_are_safe() {
        let s = SettingsV1::default();
        assert_eq!(s.version, SETTINGS_VERSION);
        assert_eq!(s.theme, Theme::System);
        assert!(!s.editor_visible);
        assert_eq!(s.split_ratio, 0.5);
        assert!(s.recent_files.files.is_empty());
        assert!(s.root_overrides.is_empty());
        assert!(s.window_state.is_none());
    }

    #[test]
    fn recent_files_cap_and_dedup() {
        let mut recent = BoundedRecentFiles::default();
        for i in 0..15 {
            recent.push(PathBuf::from(format!("C:\\docs\\file{i}.typ")));
        }
        assert_eq!(recent.files.len(), BoundedRecentFiles::MAX_FILES);
        assert_eq!(recent.files[0], PathBuf::from("C:\\docs\\file14.typ"));
        // Re-push the front entry; it dedupes without growing.
        recent.push(PathBuf::from("C:\\docs\\file14.typ"));
        assert_eq!(recent.files.len(), BoundedRecentFiles::MAX_FILES);
        assert_eq!(recent.files[0], PathBuf::from("C:\\docs\\file14.typ"));
    }

    #[test]
    fn migrate_round_trips_serialized_settings() {
        let settings = SettingsV1 {
            theme: Theme::Dark,
            editor_visible: true,
            split_ratio: 0.62,
            recent_files: BoundedRecentFiles {
                files: vec![PathBuf::from("C:\\a\\b.typ")],
            },
            root_overrides: {
                let mut m = HashMap::new();
                m.insert(PathBuf::from("C:\\a\\b.typ"), PathBuf::from("C:\\a"));
                m
            },
            ..Default::default()
        };
        let json = serde_json::to_value(&settings).unwrap();
        let migrated = SettingsV1::migrate(&json).expect("migrate");
        assert_eq!(migrated, settings);
    }

    #[test]
    fn migrate_fills_defaults_for_missing_fields() {
        let json = serde_json::json!({});
        let s = SettingsV1::migrate(&json).expect("migrate");
        assert_eq!(s, SettingsV1::default());
    }

    #[test]
    fn migrate_rejects_newer_version() {
        let json = serde_json::json!({ "version": 99 });
        assert!(SettingsV1::migrate(&json).is_none());
    }

    #[test]
    fn migrate_handles_partial_window_state() {
        let json = serde_json::json!({
            "version": 1,
            "window_state": { "x": 10, "y": 20, "width": 800, "height": 600 }
        });
        let s = SettingsV1::migrate(&json).expect("migrate");
        assert_eq!(
            s.window_state,
            Some(WindowState {
                x: 10,
                y: 20,
                width: 800,
                height: 600,
                maximized: false
            })
        );
    }
}
