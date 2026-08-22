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

/// Well-known config location for Tykuru on Windows: `%LOCALAPPDATA%/Tykuru`.
///
/// The `settings.json` file lives directly in this directory (architecture
/// §18). The settings store is bounded to this root.
pub fn tykuru_config_root() -> Option<PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    Some(PathBuf::from(local).join("Tykuru"))
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

/// Selects the first launch argument that is a usable `.typ` document path
/// (architecture §9, Stage 11). Returns `None` (not an error) when no document
/// argument is present, so a normal window launch is unaffected.
///
/// Rules:
/// - skips `--flag`-style and other option arguments;
/// - converts `file:///C:/...` URIs to native paths;
/// - ignores `http(s)://` URLs (never treated as document paths);
/// - only checks the `.typ` extension here; existence/readability is validated
///   later by `OpenRequestRouter::validate` once the window is ready.
///
/// The path is never shell-interpolated; it is passed to the router as-is.
pub fn parse_launch_args(args: Vec<String>) -> Option<PathBuf> {
    for arg in args {
        let trimmed = arg.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with('-') {
            continue; // flag/option
        }
        let lower = trimmed.to_ascii_lowercase();
        if lower.starts_with("http://") || lower.starts_with("https://") {
            continue; // remote URL, not a document path
        }
        let candidate: PathBuf = if lower.starts_with("file://") {
            // file:///C:/path or file:///C:\path → strip scheme and slashes
            let rest = trimmed
                .trim_start_matches("file://")
                .trim_start_matches('/');
            // Rebuild a Windows path: replace forward slashes.
            PathBuf::from(rest.replace('/', "\\"))
        } else {
            PathBuf::from(trimmed)
        };
        if has_typ_extension(&candidate) {
            return Some(candidate);
        }
    }
    None
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

#[cfg(test)]
mod launch_args_tests {
    use super::*;

    fn args(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn picks_simple_typ_path() {
        let out = parse_launch_args(args(&["tykuru.exe", "C:\\paper\\main.typ"])).unwrap();
        assert_eq!(out, PathBuf::from("C:\\paper\\main.typ"));
    }

    #[test]
    fn picks_path_with_spaces() {
        let out = parse_launch_args(args(&["tykuru.exe", "C:\\My Paper\\main.typ"])).unwrap();
        assert_eq!(out, PathBuf::from("C:\\My Paper\\main.typ"));
    }

    #[test]
    fn picks_unicode_path() {
        let out = parse_launch_args(args(&["tykuru.exe", "C:\\用户\\论文.typ"])).unwrap();
        assert_eq!(out, PathBuf::from("C:\\用户\\论文.typ"));
    }

    #[test]
    fn converts_file_uri() {
        let out = parse_launch_args(args(&["tykuru.exe", "file:///C:/paper/main.typ"])).unwrap();
        assert_eq!(out, PathBuf::from("C:\\paper\\main.typ"));
    }

    #[test]
    fn ignores_flags() {
        assert!(parse_launch_args(args(&["tykuru.exe", "--flag"])).is_none());
    }

    #[test]
    fn ignores_remote_url() {
        assert!(parse_launch_args(args(&["tykuru.exe", "https://example.com/file.typ"])).is_none());
    }

    #[test]
    fn no_args_returns_none() {
        assert!(parse_launch_args(args(&["tykuru.exe"])).is_none());
    }

    #[test]
    fn skips_flags_before_finding_path() {
        let out =
            parse_launch_args(args(&["tykuru.exe", "--verbose", "C:\\paper\\main.typ"])).unwrap();
        assert_eq!(out, PathBuf::from("C:\\paper\\main.typ"));
    }
}
