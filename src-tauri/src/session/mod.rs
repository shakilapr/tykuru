//! Document session module: one active Typst document.

pub mod manager;
pub mod model;
pub mod root;

pub use manager::{CloseError, SessionManager};
pub use model::{DocumentSession, SessionError, SessionId};
pub use root::{ProjectRootService, RootError};
