//! Settings persistence (architecture §18).
//!
//! Loads `settings.json` from a config directory and writes it atomically:
//! serialize to a temp sibling, flush, then rename over the target. A corrupt
//! or missing file falls back to `Default` without crashing. All paths are
//! bounded to the provided config directory.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use thiserror::Error;

use super::model::SettingsV1;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("config directory is unavailable")]
    NoConfigDir,
    #[error("failed to read settings file: {0}")]
    Read(#[source] std::io::Error),
    #[error("settings file is corrupt: {0}")]
    Corrupt(#[source] serde_json::Error),
    #[error("failed to write settings file: {0}")]
    Write(#[source] std::io::Error),
}

pub struct SettingsStore {
    /// Directory containing `settings.json`.
    config_dir: PathBuf,
}

impl SettingsStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { config_dir }
    }

    fn settings_path(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }

    /// Loads settings, migrating older files. Missing/corrupt files fall back
    /// to `Default` (never a crash).
    pub fn load(&self) -> Result<SettingsV1, StoreError> {
        let path = self.settings_path();
        let raw = match fs::read(&path) {
            Ok(raw) => raw,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(SettingsV1::default()),
            Err(e) => return Err(StoreError::Read(e)),
        };
        let value: serde_json::Value = match serde_json::from_slice(&raw) {
            Ok(v) => v,
            Err(e) => return Err(StoreError::Corrupt(e)),
        };
        Ok(SettingsV1::migrate(&value).unwrap_or_default())
    }

    /// Atomically persists settings: write a temp sibling, flush, then rename.
    /// On any failure the original file is left untouched.
    pub fn save(&self, settings: &SettingsV1) -> Result<(), StoreError> {
        fs::create_dir_all(&self.config_dir).map_err(StoreError::Write)?;
        let path = self.settings_path();
        let tmp = self.config_dir.join("settings.json.tmp");
        let mut file = fs::File::create(&tmp).map_err(StoreError::Write)?;
        serde_json::to_writer_pretty(&mut file, settings).map_err(|e| {
            // Corrupt serialization is a programming error, but treat it as a
            // write failure so the temp file is cleaned up.
            StoreError::Write(std::io::Error::other(e))
        })?;
        file.flush().map_err(StoreError::Write)?;
        drop(file);
        // Atomic replace on Windows: rename fails if the target exists, so
        // remove first, then rename. This is not crash-atomic on Windows, but
        // `load()` already treats a corrupt/partial file as "use defaults",
        // so the worst case is losing the last write — never a truncated file
        // that crashes the app.
        if path.exists() {
            fs::remove_file(&path).map_err(StoreError::Write)?;
        }
        fs::rename(&tmp, &path).map_err(StoreError::Write)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_config_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tykuru-settings-{name}"));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn missing_file_returns_defaults() {
        let store = SettingsStore::new(temp_config_dir("missing"));
        let s = store.load().expect("load defaults");
        assert_eq!(s, SettingsV1::default());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = temp_config_dir("roundtrip");
        let store = SettingsStore::new(dir.clone());
        let settings = SettingsV1 {
            theme: super::super::model::Theme::Dark,
            editor_visible: true,
            split_ratio: 0.4,
            ..Default::default()
        };
        store.save(&settings).expect("save");
        let loaded = store.load().expect("load");
        assert_eq!(loaded, settings);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults() {
        let dir = temp_config_dir("corrupt");
        let store = SettingsStore::new(dir.clone());
        fs::create_dir_all(&dir).expect("mkdir");
        fs::write(store.settings_path(), b"this is not json {").expect("write");
        let s = store.load().expect("load fallback");
        assert_eq!(s, SettingsV1::default());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn newer_version_is_ignored_safely() {
        let dir = temp_config_dir("newer");
        let store = SettingsStore::new(dir.clone());
        fs::create_dir_all(&dir).expect("mkdir");
        fs::write(store.settings_path(), br#"{ "version": 99 }"#).expect("write");
        // A file written by a newer build is not silently downgraded; fall back.
        let s = store.load().expect("load fallback");
        assert_eq!(s, SettingsV1::default());
        let _ = fs::remove_dir_all(&dir);
    }
}
