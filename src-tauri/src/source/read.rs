//! Reading the active session's entry source file (architecture §3.2).

use std::fs;
use std::path::Path;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum SourceReadError {
    #[error("no active session for source read")]
    NoActiveSession,
    #[error("failed to read source file: {0}")]
    Read(#[source] std::io::Error),
}

/// Reads the entry file of the active session as UTF-8 text.
///
/// Only the active session's entry path is ever read; callers resolve it from
/// the session model, never from a frontend-supplied path (§20).
pub fn read_source(entry_path: &Path) -> Result<String, SourceReadError> {
    let bytes = fs::read(entry_path).map_err(SourceReadError::Read)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}
