// System tray management commands (Phase 3)
//
// Tauri commands for updating system tray icon and menu state.
// Uses Tauri managed state (TrayManagerState) so setup and commands share the same instance.

use crate::tray::{TrayMenuManager, TrayMenuState};
use std::sync::Mutex;

/// Wrapper for Tauri managed state
pub struct TrayManagerState(pub Mutex<TrayMenuManager>);

/// Update tray menu state
#[tauri::command]
pub async fn update_tray_state(
    app: tauri::AppHandle,
    state: TrayMenuState,
    tray: tauri::State<'_, TrayManagerState>,
) -> Result<(), String> {
    let manager = tray.0.lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    manager.update_state(&app, state)
}

/// Get current tray menu state
#[tauri::command]
pub async fn get_tray_state(
    tray: tauri::State<'_, TrayManagerState>,
) -> Result<TrayMenuState, String> {
    let manager = tray.0.lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    manager.get_state()
}

/// Setup tray (should be called during app initialization)
#[tauri::command]
pub async fn setup_tray(
    app: tauri::AppHandle,
    tray: tauri::State<'_, TrayManagerState>,
) -> Result<(), String> {
    let manager = tray.0.lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    manager.setup(&app)
}

/// Update tray tooltip
#[tauri::command]
pub async fn set_tray_tooltip(
    app: tauri::AppHandle,
    tooltip: String,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&tooltip))
            .map_err(|e| format!("Failed to set tooltip: {}", e))?;
    }
    Ok(())
}

/// Update show/hide menu item text (DEPRECATED - use update_tray_state with full state)
#[tauri::command]
pub async fn update_tray_show_hide(
    app: tauri::AppHandle,
    is_visible: bool,
    tray: tauri::State<'_, TrayManagerState>,
) -> Result<(), String> {
    let manager = tray.0.lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    let mut state = manager.get_state()?;
    state.window_visible = is_visible;
    manager.update_state(&app, state)
}
