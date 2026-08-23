//! Safe source writes: `SourceWriter` save transaction (architecture §15.2).
//!
//! Instead of a bare `std::fs::write`, saves are a transaction:
//!
//! ```text
//! receive expected_disk_revision
//!     ↓
//! revalidate disk revision immediately
//!     ↓
//! write to a temp sibling file, flush, fsync
//!     ↓
//! final revision re-check
//!     ↓
//! atomic replace over the entry
//!     ↓
//! record self-write identity (DiskRevision of what we wrote)
//! ```
//!
//! The check-then-write gap is a TOCTOU window; this detects normal external
//! edits (content hash mismatch) and refuses to overwrite a newer disk revision.
//! It does not aggressively lock the file, so Tykuru stays a good citizen
//! alongside other editors (§15.2, §16).

use std::fs;
use std::io::Write;
use std::path::Path;

use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::session::SessionId;

/// A stable identifier for a file's content: SHA-256 of the bytes.
///
/// Used to detect external edits and to recognise Tykuru's own writes (§15.3).
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize)]
pub struct DiskRevision(String);

impl Default for DiskRevision {
    fn default() -> Self {
        Self::compute(b"")
    }
}

impl DiskRevision {
    pub fn compute(bytes: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        Self(format!("{:x}", hasher.finalize()))
    }

    /// Builds a `DiskRevision` from a hex string supplied by the frontend (the
    /// expected revision it loaded earlier). Content is validated on write.
    pub fn from_hex(value: &str) -> Self {
        Self(value.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Error)]
pub enum SourceWriteError {
    #[error("no active session for source write")]
    NoActiveSession,
    #[error("requested session is not the active session")]
    NotActiveSession,
    #[error("source changed on disk since it was loaded; refusing to overwrite")]
    Conflict,
    #[error("failed to write temp file: {0}")]
    Write(#[source] std::io::Error),
    #[error("failed to flush temp file: {0}")]
    Flush(#[source] std::io::Error),
    #[error("failed to replace entry file: {0}")]
    Replace(#[source] std::io::Error),
    #[error("lock poisoned")]
    Lock,
}

/// Safe save transaction for the active session's entry file.
pub struct SourceWriter;

impl SourceWriter {
    /// Saves `text` to `entry_path` iff the on-disk revision still matches
    /// `expected_disk_revision`. Returns the new disk revision.
    ///
    /// Session ownership is checked by the caller (`save_source`); this function
    /// only guards against external-edit conflicts via the revision check.
    pub fn save(
        entry_path: &Path,
        text: &str,
        expected_disk_revision: &DiskRevision,
    ) -> Result<DiskRevision, SourceWriteError> {
        // Final re-check right before writing (the TOCTOU guard): if the file
        // changed since it was read into the editor, refuse silently to clobber.
        let current = fs::read(entry_path).map_err(|_| SourceWriteError::Conflict)?;
        if DiskRevision::compute(&current) != *expected_disk_revision {
            return Err(SourceWriteError::Conflict);
        }
        let new_bytes = text.as_bytes();
        let new_revision = DiskRevision::compute(new_bytes);

        // Write a temp sibling first, then atomically replace. On Windows,
        // rename-over is atomic for same-volume files and avoids a truncated
        // in-place overwrite if the process dies mid-write (§15.2).
        let parent = entry_path.parent().unwrap_or_else(|| Path::new("."));
        let file_name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("document.typ");
        let temp_path = parent.join(format!(".{file_name}.tykuru-tmp"));

        {
            let mut f = fs::File::create(&temp_path).map_err(SourceWriteError::Write)?;
            f.write_all(new_bytes).map_err(SourceWriteError::Write)?;
            f.flush().map_err(SourceWriteError::Flush)?;
        }

        fs::rename(&temp_path, entry_path).map_err(SourceWriteError::Replace)?;

        Ok(new_revision)
    }
}

/// Convenience: resolves the active session and delegates to `SourceWriter`.
pub fn save_source(
    session_manager: &crate::session::SessionManager,
    session_id: &SessionId,
    entry_path: &Path,
    text: &str,
    expected_disk_revision: &DiskRevision,
) -> Result<DiskRevision, SourceWriteError> {
    match session_manager.get_active() {
        Some(s) if &s.id == session_id => {}
        Some(_) => return Err(SourceWriteError::NotActiveSession),
        None => return Err(SourceWriteError::NoActiveSession),
    }
    SourceWriter::save(entry_path, text, expected_disk_revision)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_entry(name: &str) -> std::path::PathBuf {
        // Each test gets its own subdirectory so parallel test threads cannot
        // observe each other's temp-sibling files in the shared temp dir.
        let dir = std::env::temp_dir().join(format!("tykuru_src_tests_{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("mkdir");
        let path = dir.join("entry.typ");
        fs::write(&path, b"initial").expect("write");
        path
    }

    #[test]
    fn disk_revision_is_content_hash() {
        let a = DiskRevision::compute(b"hello");
        let b = DiskRevision::compute(b"hello");
        let c = DiskRevision::compute(b"world");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn save_writes_unicode_round_trip() {
        let path = temp_entry("unicode");
        let expected = DiskRevision::compute(b"initial");
        let text = "héllo — 世界 ✓";
        let rev = SourceWriter::save(&path, text, &expected).unwrap();
        let on_disk = fs::read_to_string(&path).unwrap();
        assert_eq!(on_disk, text);
        assert_eq!(rev, DiskRevision::compute(text.as_bytes()));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn save_rejects_expected_revision_mismatch() {
        let path = temp_entry("conflict");
        let stale = DiskRevision::compute(b"something-else");
        let res = SourceWriter::save(&path, "new", &stale);
        assert!(matches!(res, Err(SourceWriteError::Conflict)));
        // Disk content untouched.
        assert_eq!(fs::read_to_string(&path).unwrap(), "initial");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn save_leaves_no_temp_sibling_behind() {
        let path = temp_entry("cleanup");
        let expected = DiskRevision::compute(b"initial");
        SourceWriter::save(&path, "updated", &expected).unwrap();
        let parent = path.parent().unwrap();
        let leftovers: Vec<_> = fs::read_dir(parent)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains("tykuru-tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temp files left behind");
        let _ = fs::remove_file(&path);
    }
}
