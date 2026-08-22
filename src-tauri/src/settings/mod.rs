//! Settings subsystem: typed, atomic persistence (architecture §18).

pub mod model;
pub mod store;

pub use model::{
    BoundedRecentFiles, RootOverrideMap, SettingsV1, Theme, WindowState, SETTINGS_VERSION,
};
pub use store::{SettingsStore, StoreError};
