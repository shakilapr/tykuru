//! Immutable preview revision store.
//!
//! Typst writes a single `candidate.pdf` that it may replace at any time. PDF.js
//! must never read a file Typst is still writing, so Tykuru copies a *stable*
//! snapshot into a freshly named, immutable revision file and publishes only
//! that revision (architecture §12, §12.1). Revision numbers are monotonic per
//! session (§12.2).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;
use thiserror::Error;

use crate::session::SessionId;

/// An immutable, published PDF revision addressed by session + number.
#[derive(Debug, Clone, Serialize)]
pub struct PreviewRevision {
    pub session_id: SessionId,
    pub number: u64,
    pub path: PathBuf,
}

#[derive(Debug, Error)]
pub enum RevisionError {
    #[error("no active session for revision commit")]
    NoActiveSession,
    #[error("candidate read was unstable (file changed while reading)")]
    UnstableRead,
    #[error("candidate is empty")]
    Empty,
    #[error("candidate is not a PDF (missing %PDF- signature)")]
    NotPdf,
    #[error("candidate is missing trailing %%EOF marker")]
    Truncated,
    #[error("failed to read candidate: {0}")]
    Read(#[source] std::io::Error),
    #[error("failed to write revision: {0}")]
    Write(#[source] std::io::Error),
    #[error("revision not found")]
    NotFound,
    #[error("unknown session")]
    UnknownSession,
}

/// Number of most-recent revisions retained per session. Older revisions are
/// deleted (root-bounded to the session cache dir, §17).
const KEEP_REVISIONS: usize = 3;

/// Per-session revision ledger.
#[derive(Default)]
pub struct RevisionStore {
    next: u64,
    current: Option<u64>,
    published: Vec<PreviewRevision>,
}

impl RevisionStore {
    /// Commits a verified, stable candidate snapshot as a new immutable revision.
    ///
    /// `candidate` bytes must already be a stable, complete read (see
    /// `read_stable_candidate`). Writes `<cache>/revision-{:06}.pdf`, marks it
    /// current, and garbage-collects all but the newest `KEEP_REVISIONS`.
    pub fn commit(
        &mut self,
        session_id: &SessionId,
        cache_dir: &Path,
        candidate_bytes: &[u8],
    ) -> Result<PreviewRevision, RevisionError> {
        let number = self.next;
        self.next += 1;
        let file_name = format!("revision-{number:06}.pdf");
        let revision_path = cache_dir.join(file_name);

        std::fs::write(&revision_path, candidate_bytes).map_err(RevisionError::Write)?;

        let revision = PreviewRevision {
            session_id: session_id.clone(),
            number,
            path: revision_path,
        };
        self.current = Some(number);
        self.published.push(revision.clone());
        self.gc(cache_dir);
        Ok(revision)
    }

    /// Deletes all but the newest `KEEP_REVISIONS` revisions, bounded strictly to
    /// `cache_dir`. A sibling path can never be removed.
    fn gc(&mut self, cache_dir: &Path) {
        while self.published.len() > KEEP_REVISIONS {
            if let Some(old) = self.published.first() {
                // Root-bounded delete: only remove files that live under cache_dir.
                if old.path.starts_with(cache_dir) {
                    let _ = std::fs::remove_file(&old.path);
                }
                self.published.remove(0);
            } else {
                break;
            }
        }
    }

    pub fn current(&self) -> Option<u64> {
        self.current
    }

    pub fn is_published(&self, number: u64) -> bool {
        self.published.iter().any(|r| r.number == number)
    }

    pub fn path_for(&self, number: u64) -> Option<&PathBuf> {
        self.published
            .iter()
            .find(|r| r.number == number)
            .map(|r| &r.path)
    }
}

/// Performs a bounded stable full read of `candidate_path`.
///
/// Reads fully, re-stats, and requires the size to be unchanged across a short
/// window (a few retries). This guards against publishing a half-written PDF
/// when Typst is still replacing the file (architecture §12.1 step 3).
pub fn read_stable_candidate(candidate_path: &Path) -> Result<Vec<u8>, RevisionError> {
    let mut last: Option<Vec<u8>> = None;
    for _ in 0..5 {
        let bytes = std::fs::read(candidate_path).map_err(RevisionError::Read)?;
        if bytes.is_empty() {
            return Err(RevisionError::Empty);
        }
        if last.as_deref() == Some(bytes.as_slice()) {
            return Ok(bytes);
        }
        last = Some(bytes);
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    Err(RevisionError::UnstableRead)
}

/// Basic PDF sanity: leading `%PDF-` and a trailing `%%EOF` marker somewhere in
/// the tail. No full PDF parser is introduced (architecture §12.1 step 5).
pub fn looks_like_pdf(bytes: &[u8]) -> bool {
    if !bytes.starts_with(b"%PDF-") {
        return false;
    }
    let tail = if bytes.len() > 1024 {
        &bytes[bytes.len() - 1024..]
    } else {
        bytes
    };
    tail.windows(5).any(|w| w == b"%%EOF")
}

/// In-memory map of per-session revision stores, owned by `AppState`.
#[derive(Default)]
pub struct RevisionRegistry {
    stores: HashMap<SessionId, RevisionStore>,
}

impl RevisionRegistry {
    pub fn store_mut(&mut self, session_id: &SessionId) -> &mut RevisionStore {
        self.stores.entry(session_id.clone()).or_default()
    }

    pub fn store(&self, session_id: &SessionId) -> Option<&RevisionStore> {
        self.stores.get(session_id)
    }

    pub fn remove(&mut self, session_id: &SessionId) -> Option<RevisionStore> {
        self.stores.remove(session_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_cache(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("tykuru_rev_{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    fn good_pdf() -> Vec<u8> {
        // Minimal but valid-enough snapshot for our sanity checks.
        let mut v = b"%PDF-1.4\n".to_vec();
        v.extend_from_slice(b"some content\n");
        v.extend_from_slice(b"%%EOF\n");
        v
    }

    #[test]
    fn commits_immutable_revision_and_increments() {
        let cache = temp_cache("incr");
        let sid = SessionId::generate();
        let mut store = RevisionStore::default();
        let r1 = store.commit(&sid, &cache, &good_pdf()).unwrap();
        let r2 = store.commit(&sid, &cache, &good_pdf()).unwrap();
        assert_eq!(r1.number, 0);
        assert_eq!(r2.number, 1);
        assert_eq!(store.current(), Some(1));
        assert!(r1.path.exists());
        assert!(r2.path.exists());
        let _ = std::fs::remove_dir_all(&cache);
    }

    #[test]
    fn rejects_empty_candidate() {
        let cache = temp_cache("empty");
        let sid = SessionId::generate();
        let mut store = RevisionStore::default();
        let res = store.commit(&sid, &cache, &[]);
        assert!(matches!(
            res,
            Err(RevisionError::Write(_)) | Err(RevisionError::Empty)
        ));
        let _ = std::fs::remove_dir_all(&cache);
    }

    #[test]
    fn looks_like_pdf_checks_signature_and_eof() {
        assert!(looks_like_pdf(&good_pdf()));
        assert!(!looks_like_pdf(b"not a pdf at all"));
        assert!(!looks_like_pdf(b"%PDF-1.4\nno eof here"));
    }

    #[test]
    fn gc_keeps_only_newest_revisions_under_cache() {
        let cache = temp_cache("gc");
        let sid = SessionId::generate();
        let mut store = RevisionStore::default();
        for _ in 0..6 {
            store.commit(&sid, &cache, &good_pdf()).unwrap();
        }
        // Only KEEP_REVISIONS remain; all under cache_dir.
        assert!(store.published.len() <= KEEP_REVISIONS);
        for r in &store.published {
            assert!(r.path.starts_with(&cache));
        }
        let _ = std::fs::remove_dir_all(&cache);
    }

    #[test]
    fn read_stable_candidate_rejects_empty_file() {
        let cache = temp_cache("stable");
        let path = cache.join("candidate.pdf");
        std::fs::write(&path, b"").unwrap();
        let res = read_stable_candidate(&path);
        assert!(matches!(res, Err(RevisionError::Empty)));
        let _ = std::fs::remove_dir_all(&cache);
    }

    #[test]
    fn read_stable_candidate_accepts_unchanged_file() {
        let cache = temp_cache("stable_ok");
        let path = cache.join("candidate.pdf");
        std::fs::write(&path, good_pdf()).unwrap();
        let bytes = read_stable_candidate(&path).unwrap();
        assert_eq!(bytes, good_pdf());
        let _ = std::fs::remove_dir_all(&cache);
    }
}
