// System Tray Module
//
// Entry point for tray menu management and event handling.
// Exports public types and modules for use by IPC commands.

pub mod types;
pub mod menu;

// Re-export primary types for convenience
pub use types::{
    MouseButton, TrayMenu, TrayMenuItem, TrayMenuItemId, TrayMenuItemType, TrayMenuState,
};

// Re-export IPC message types
pub use types::{
    GetTrayMenuStateRequest, GetTrayMenuStateResponse, SetTrayIconRequest, SetTrayIconResponse,
    SetTrayTooltipRequest, SetTrayTooltipResponse, TrayIconType, UpdateTrayMenuRequest,
    UpdateTrayMenuResponse,
};

// Re-export event types
pub use types::{MenuItemClickedEventPayload, TrayIconClickedEventPayload};

// Re-export menu builder
pub use menu::{TrayMenuManager, setup_window_close_handler};
