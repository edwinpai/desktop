// System Tray Menu Builder (Tauri v2)
//
// Implements dynamic tray menu construction using TrayIconBuilder.
// Features:
// - Status line showing gateway & subscription state
// - Channel count display
// - Pause/Resume toggle
// - Open window, Settings, Quit actions
// - Window close event handler to minimize-to-tray

use crate::tray::types::{TrayMenuItemId, TrayMenuState};
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow,
};

/// Tray menu manager with dynamic menu building
pub struct TrayMenuManager {
    state: Arc<Mutex<TrayMenuState>>,
    tray_icon: Arc<Mutex<Option<TrayIcon<tauri::Wry>>>>,
}

impl TrayMenuManager {
    /// Create a new tray menu manager
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(TrayMenuState::default())),
            tray_icon: Arc::new(Mutex::new(None)),
        }
    }

    /// Initialize tray icon with menu
    pub fn setup(&self, app: &AppHandle<tauri::Wry>) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let menu = self.build_menu_items(app, &state)?;
        let tray = self.build_tray_icon(app, menu)?;

        // Store tray icon reference
        let mut tray_lock = self
            .tray_icon
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        *tray_lock = Some(tray);

        Ok(())
    }

    /// Build menu items based on current state
    fn build_menu_items(
        &self,
        app: &AppHandle<tauri::Wry>,
        state: &TrayMenuState,
    ) -> Result<Menu<tauri::Wry>, String> {
        // Status line (non-clickable)
        let status_text = self.format_status_line(state);
        let status_item = MenuItem::with_id(
            app,
            TrayMenuItemId::GatewayStatus.as_str(),
            status_text,
            false, // disabled - just for display
            None::<&str>,
        )
        .map_err(|e| format!("Failed to create status item: {}", e))?;

        // Channel count (non-clickable)
        let channel_text = format!("Channels: {}", self.get_channel_count(state));
        let channel_item = MenuItem::with_id(
            app,
            "channel_count",
            channel_text,
            false, // disabled
            None::<&str>,
        )
        .map_err(|e| format!("Failed to create channel item: {}", e))?;

        // Separator
        let sep1 = PredefinedMenuItem::separator(app)
            .map_err(|e| format!("Failed to create separator: {}", e))?;

        // Pause/Resume toggle
        let pause_resume_text = if state.gateway_running {
            "Pause Gateway"
        } else {
            "Resume Gateway"
        };
        let pause_resume = MenuItem::with_id(
            app,
            "pause_resume_gateway",
            pause_resume_text,
            true, // enabled
            None::<&str>,
        )
        .map_err(|e| format!("Failed to create pause/resume item: {}", e))?;

        // Open window
        let show_window = MenuItem::with_id(
            app,
            TrayMenuItemId::ShowWindow.as_str(),
            if state.window_visible {
                "Hide EdwinPAI"
            } else {
                "Show EdwinPAI"
            },
            true,
            None::<&str>,
        )
        .map_err(|e| format!("Failed to create show window item: {}", e))?;

        // Settings
        let settings = MenuItem::with_id(
            app,
            TrayMenuItemId::Settings.as_str(),
            "Settings",
            true,
            None::<&str>,
        )
        .map_err(|e| format!("Failed to create settings item: {}", e))?;

        // Separator
        let sep2 = PredefinedMenuItem::separator(app)
            .map_err(|e| format!("Failed to create separator: {}", e))?;

        // Quit
        let quit = MenuItem::with_id(
            app,
            TrayMenuItemId::Quit.as_str(),
            "Quit EdwinPAI",
            true,
            None::<&str>,
        )
        .map_err(|e| format!("Failed to create quit item: {}", e))?;

        // Build menu
        Menu::with_items(
            app,
            &[
                &status_item,
                &channel_item,
                &sep1,
                &pause_resume,
                &show_window,
                &settings,
                &sep2,
                &quit,
            ],
        )
        .map_err(|e| format!("Failed to create menu: {}", e))
    }

    /// Build tray icon with event handlers
    fn build_tray_icon(
        &self,
        app: &AppHandle<tauri::Wry>,
        menu: Menu<tauri::Wry>,
    ) -> Result<TrayIcon<tauri::Wry>, String> {
        let _app_handle = app.clone();
        let state_clone = self.state.clone();
        let tray_icon = Self::resolve_tray_icon(app)?;

        TrayIconBuilder::with_id("main")
            .menu(&menu)
            .icon(tray_icon)
            .tooltip("EdwinPAI Desktop")
            .on_menu_event(move |app, event| {
                Self::handle_menu_event(app, event.id.as_ref(), &state_clone);
            })
            .on_tray_icon_event(move |tray, event| {
                Self::handle_tray_icon_event(tray, event);
            })
            .build(app)
            .map_err(|e| format!("Failed to build tray icon: {}", e))
    }

    fn resolve_tray_icon(_app: &AppHandle<tauri::Wry>) -> Result<Image<'static>, String> {
        #[cfg(target_os = "linux")]
        {
            Image::from_bytes(include_bytes!("../../icons/tray-linux.png"))
                .map(|image| image.to_owned())
                .map_err(|e| format!("Failed to load Linux tray icon: {}", e))
        }

        #[cfg(not(target_os = "linux"))]
        {
            Image::from_bytes(include_bytes!("../../icons/32x32.png"))
                .map(|image| image.to_owned())
                .map_err(|e| format!("Failed to load tray icon: {}", e))
        }
    }

    /// Handle menu item clicks
    fn handle_menu_event(app: &AppHandle, item_id: &str, state: &Arc<Mutex<TrayMenuState>>) {
        match item_id {
            "show_window" | "hide_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    Self::toggle_window_visibility(&window, state);
                }
            }
            "pause_resume_gateway" => {
                Self::toggle_gateway_pause(app, state);
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Emit event to navigate to settings
                    let _ = app.emit("navigate-to-settings", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        }
    }

    /// Handle tray icon clicks
    fn handle_tray_icon_event(tray: &TrayIcon, event: TrayIconEvent) {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
    }

    /// Toggle window visibility
    fn toggle_window_visibility(window: &WebviewWindow, state: &Arc<Mutex<TrayMenuState>>) {
        if let Ok(is_visible) = window.is_visible() {
            if is_visible {
                let _ = window.hide();
                if let Ok(mut state_lock) = state.lock() {
                    state_lock.window_visible = false;
                }
            } else {
                let _ = window.show();
                let _ = window.set_focus();
                if let Ok(mut state_lock) = state.lock() {
                    state_lock.window_visible = true;
                }
            }
        }
    }

    /// Toggle gateway pause state
    fn toggle_gateway_pause(app: &AppHandle, state: &Arc<Mutex<TrayMenuState>>) {
        if let Ok(mut state_lock) = state.lock() {
            state_lock.gateway_running = !state_lock.gateway_running;
            // Emit event to backend to actually pause/resume
            let _ = app.emit(
                "gateway-toggle",
                serde_json::json!({ "running": state_lock.gateway_running }),
            );
        }
    }

    /// Format status line text
    fn format_status_line(&self, state: &TrayMenuState) -> String {
        let gateway_status = if state.gateway_running {
            if state.gateway_healthy {
                "🟢 Gateway: Running"
            } else {
                "🟡 Gateway: Unhealthy"
            }
        } else {
            "🔴 Gateway: Stopped"
        };

        let sub_status = if state.subscription_active {
            "✓ Subscribed"
        } else {
            "✗ No Subscription"
        };

        format!("{} | {}", gateway_status, sub_status)
    }

    fn get_channel_count(&self, state: &TrayMenuState) -> usize {
        state.channel_count
    }

    /// Update tray menu state and rebuild menu
    pub fn update_state(&self, app: &AppHandle, new_state: TrayMenuState) -> Result<(), String> {
        // Update state
        {
            let mut state = self
                .state
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            *state = new_state.clone();
        }

        // Rebuild menu
        let menu = self.build_menu_items(app, &new_state)?;

        // Update tray icon menu
        let tray_lock = self
            .tray_icon
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        if let Some(tray) = tray_lock.as_ref() {
            tray.set_menu(Some(menu))
                .map_err(|e| format!("Failed to update menu: {}", e))?;
        }

        Ok(())
    }

    /// Get current state
    pub fn get_state(&self) -> Result<TrayMenuState, String> {
        let state = self
            .state
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        Ok(state.clone())
    }
}

impl Default for TrayMenuManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Setup window close event handler to minimize-to-tray
pub fn setup_window_close_handler(window: &WebviewWindow) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            // Prevent window from closing and hide it instead
            let _ = window_clone.hide();
            api.prevent_close();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_menu_manager_creation() {
        let manager = TrayMenuManager::new();
        let state = manager.get_state().unwrap();
        assert_eq!(state.window_visible, true);
        assert_eq!(state.gateway_running, false);
    }

    #[test]
    fn test_status_line_formatting() {
        let manager = TrayMenuManager::new();
        let state = TrayMenuState {
            window_visible: true,
            gateway_running: true,
            gateway_healthy: true,
            subscription_active: true,
            update_available: false,
            channel_count: 2,
        };

        let status = manager.format_status_line(&state);
        assert!(status.contains("Running"));
        assert!(status.contains("Subscribed"));
    }

    #[test]
    fn test_channel_count() {
        let manager = TrayMenuManager::new();
        let state = TrayMenuState::default();
        assert_eq!(manager.get_channel_count(&state), 0);
    }
}
