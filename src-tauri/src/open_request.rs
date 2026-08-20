//! Open-request normalization and path validation.
//!
//! Every way of opening a `.typ` file (Start screen, File/Open, drag/drop, argv,
//! Open With, second-instance forwarding) funnels through `OpenRequestRouter`
//! so validation and canonicalization happen in exactly one place (architecture
//! §9, §9.1). The frontend never performs filesystem validation; it only passes
//! a path string here.

use std::path::{Path, PathBuf};

use thiserror::Error;

/// Well-known cache location for Tykuru on Windows: `%LOCALAPPDATA%/Tykuru/cache`.
///
/// Returns `None` if no local data dir is available (should not happen on
/// Windows, but avoids panicking on unrealistic environments). The caller
/// bounds all generated output under this root (architecture §17).
pub fn tykuru_cache_root() -> Option<PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    Some(PathBuf::from(local).join("Tykuru").join("cache"))
}

#[derive(Debug, Error)]
pub enum OpenRequestError {
    #[error("path is empty")]
    Empty,
    #[error("not a .typ file (extension required)")]
    NotTypFile,
    #[error("path is not a regular file")]
    NotAFile,
    #[error("file does not exist")]
    Missing,
    #[error("file is not readable")]
    NotReadable,
    #[error("path could not be canonicalized: {0}")]
    Canonicalize(#[source] std::io::Error),
}

/// Normalizes and validates an open request into an absolute, canonical path.
pub struct OpenRequestRouter;

impl OpenRequestRouter {
    /// Validates `input` (a path string) and returns a canonical path.
    ///
    /// Rejects empty, missing, non-file, or non-`.typ` inputs (extension check
    /// is case-insensitive on Windows). Unicode, spaces, and parentheses are
    /// preserved as-is — no shell interpolation or string concatenation occurs.
    pub fn normalize(input: &str) -> Result<PathBuf, OpenRequestError> {
        if input.trim().is_empty() {
            return Err(OpenRequestError::Empty);
        }
        let path = PathBuf::from(input);
        Self::validate(&path)
    }

    /// Validates an already-constructed `Path`.
    pub fn validate(path: &Path) -> Result<PathBuf, OpenRequestError> {
        if !has_typ_extension(path) {
            return Err(OpenRequestError::NotTypFile);
        }
        if !path.exists() {
            return Err(OpenRequestError::Missing);
        }
        let metadata = std::fs::metadata(path).map_err(|_| OpenRequestError::NotReadable)?;
        if !metadata.is_file() {
            return Err(OpenRequestError::NotAFile);
        }
        // Canonicalize when practical; fall back to the original path if the
        // platform refuses (e.g. long-path edge cases) rather than failing the
        // open outright.
        match path.canonicalize() {
            Ok(canon) => Ok(canon),
            Err(e) => Err(OpenRequestError::Canonicalize(e)),
        }
    }
}

/// Case-insensitive `.typ` extension check (Windows allows `.TYP`, `.Typ`).
fn has_typ_extension(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => ext.eq_ignore_ascii_case("typ"),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Creates a temp `.typ` file with the given name and returns its path.
    /// The caller is responsible for the file living in the OS temp dir.
    fn make_temp_typ(name: &str) -> PathBuf {
        let dir = std::env::temp_dir();
        let path = dir.join(name);
        std::fs::write(&path, b"// tykuru test fixture\n").expect("write temp typ");
        path
    }

    #[test]
    fn accepts_typ_path() {
        let path = make_temp_typ("tykuru_accept.typ");
        let out = OpenRequestRouter::normalize(path.to_str().unwrap()).expect("valid typ");
        assert!(out.exists());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn accepts_uppercase_extensions() {
        let path = make_temp_typ("tykuru_upper.TYP");
        let out = OpenRequestRouter::normalize(path.to_str().unwrap()).expect("valid TYP");
        assert!(out.exists());
        let _ = std::fs::remove_file(&path);

        let path2 = make_temp_typ("tykuru_mixed.Typ");
        let out2 = OpenRequestRouter::normalize(path2.to_str().unwrap()).expect("valid Typ");
        assert!(out2.exists());
        let _ = std::fs::remove_file(&path2);
    }

    #[test]
    fn rejects_directory() {
        let dir = std::env::temp_dir().join("tykuru_dir_test.typ");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("mkdir");
        let err = OpenRequestRouter::normalize(dir.to_str().unwrap()).unwrap_err();
        assert!(matches!(err, OpenRequestError::NotAFile));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_non_typ_extension() {
        let dir = std::env::temp_dir();
        let path = dir.join("tykuru_reject.txt");
        std::fs::write(&path, b"x").expect("write txt");
        let err = OpenRequestRouter::normalize(path.to_str().unwrap()).unwrap_err();
        assert!(matches!(err, OpenRequestError::NotTypFile));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn rejects_missing_path() {
        let path = std::env::temp_dir().join("tykuru_does_not_exist_12345.typ");
        let err = OpenRequestRouter::normalize(path.to_str().unwrap()).unwrap_err();
        assert!(matches!(err, OpenRequestError::Missing));
    }

    #[test]
    fn rejects_empty_path() {
        let err = OpenRequestRouter::normalize("   ").unwrap_err();
        assert!(matches!(err, OpenRequestError::Empty));
    }

    #[test]
    fn preserves_spaces_in_path() {
        let path = make_temp_typ("tykuru space name.typ");
        let out = OpenRequestRouter::normalize(path.to_str().unwrap()).expect("spaces ok");
        assert!(out.to_string_lossy().contains("space name"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn preserves_unicode_path() {
        let path = make_temp_typ("tykuru_日本語_テスト.typ");
        let out = OpenRequestRouter::normalize(path.to_str().unwrap()).expect("unicode ok");
        assert!(out.exists());
        let _ = std::fs::remove_file(&path);
    }
}
