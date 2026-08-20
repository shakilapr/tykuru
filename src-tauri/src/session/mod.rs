//! Document session module: one active Typst document.

pub mod manager;
pub mod model;

pub use manager::{CloseError, SessionManager};
pub use model::{DocumentSession, SessionError, SessionId};
