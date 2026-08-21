//! Source file access: reading the active entry and safe, atomic writes.
//!
//! The entry `.typ` file is the disk authority (architecture §3.2). Reading and
//! writing it go through this module, never through ad-hoc `std::fs` calls in
//! commands, so the TOCTOU-aware save transaction (§15.2) stays the single
//! write path.

pub mod read;
pub mod write;

pub use read::{read_source, SourceReadError};
pub use write::{save_source, DiskRevision, SourceWriteError, SourceWriter};
