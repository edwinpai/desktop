// System Tray - Rust Type Definitions
//
// Defines type contracts for:
// - Tray menu structure
// - Menu item states
// - Dynamic menu updates
// - Tray event handling
//
// All implementation nodes MUST import from this module.

use serde::{Deserialize, Serialize};

// ============================================================================
// Tray Menu Items
// ============================================================================

/// Menu item types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayMenuItemType {
    Normal,
    Separator,
    Submenu,
    Checkbox,
}

/// Menu item identifier (for action routing)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayMenuItemId {
    ShowWindow,
    HideWindow,
    NewConversation,
    GatewayStatus,
    StartGateway,
    StopGateway,
    RestartGateway,
    SubscriptionStatus,
    CheckSubscription,
    Settings,
    About,
    CheckForUpdates,
    Quit,
}

impl TrayMenuItemId {
    pub fn as_str(&self) -> &str {
        match self {
            Self::ShowWindow => "show_window",
            Self::HideWindow => "hide_window",
            Self::NewConversation => "new_conversation",
            Self::GatewayStatus => "gateway_status",
            Self::StartGateway => "start_gateway",
            Self::StopGateway => "stop_gateway",
            Self::RestartGateway => "restart_gateway",
            Self::SubscriptionStatus => "subscription_status",
            Self::CheckSubscription => "check_subscription",
            Self::Settings => "settings",
            Self::About => "about",
            Self::CheckForUpdates => "check_for_updates",
            Self::Quit => "quit",
        }
    }
}

/// Tray menu item definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuItem {
    pub id: TrayMenuItemId,
    #[serde(rename = "type")]
    pub item_type: TrayMenuItemType,
    pub label: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TrayMenuItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accelerator: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Complete tray menu structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenu {
    pub items: Vec<TrayMenuItem>,
}

// ============================================================================
// Tray Menu State
// ============================================================================

/// Dynamic tray menu state (reflects app state)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuState {
    pub window_visible: bool,
    pub gateway_running: bool,
    pub gateway_healthy: bool,
    pub subscription_active: bool,
    pub update_available: bool,
    #[serde(default)]
    pub channel_count: usize,
}

impl Default for TrayMenuState {
    fn default() -> Self {
        Self {
            window_visible: true,
            gateway_running: false,
            gateway_healthy: false,
            subscription_active: false,
            update_available: false,
            channel_count: 0,
        }
    }
}

// ============================================================================
// Tray Menu Builder
// ============================================================================

impl TrayMenuState {
    /// Build tray menu based on current state
    pub fn build_menu(&self) -> TrayMenu {
        let mut items = Vec::new();

        // Window visibility toggle
        items.push(TrayMenuItem {
            id: if self.window_visible {
                TrayMenuItemId::HideWindow
            } else {
                TrayMenuItemId::ShowWindow
            },
            item_type: TrayMenuItemType::Normal,
            label: if self.window_visible {
                "Hide EdwinPAI".to_string()
            } else {
                "Show EdwinPAI".to_string()
            },
            enabled: true,
            checked: None,
            children: None,
            accelerator: Some("Ctrl+H".to_string()),
            icon: None,
        });

        // New conversation
        items.push(TrayMenuItem {
            id: TrayMenuItemId::NewConversation,
            item_type: TrayMenuItemType::Normal,
            label: "New Conversation".to_string(),
            enabled: self.gateway_running && self.subscription_active,
            checked: None,
            children: None,
            accelerator: Some("Ctrl+N".to_string()),
            icon: Some("new".to_string()),
        });

        // Separator
        items.push(TrayMenuItem {
            id: TrayMenuItemId::GatewayStatus, // Placeholder ID for separator
            item_type: TrayMenuItemType::Separator,
            label: String::new(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: None,
            icon: None,
        });

        // Gateway submenu
        let gateway_label = format!(
            "Gateway: {}",
            if self.gateway_running {
                if self.gateway_healthy {
                    "Running"
                } else {
                    "Unhealthy"
                }
            } else {
                "Stopped"
            }
        );

        items.push(TrayMenuItem {
            id: TrayMenuItemId::GatewayStatus,
            item_type: TrayMenuItemType::Submenu,
            label: gateway_label,
            enabled: true,
            checked: None,
            children: Some(vec![
                TrayMenuItem {
                    id: TrayMenuItemId::StartGateway,
                    item_type: TrayMenuItemType::Normal,
                    label: "Start Gateway".to_string(),
                    enabled: !self.gateway_running,
                    checked: None,
                    children: None,
                    accelerator: None,
                    icon: None,
                },
                TrayMenuItem {
                    id: TrayMenuItemId::StopGateway,
                    item_type: TrayMenuItemType::Normal,
                    label: "Stop Gateway".to_string(),
                    enabled: self.gateway_running,
                    checked: None,
                    children: None,
                    accelerator: None,
                    icon: None,
                },
                TrayMenuItem {
                    id: TrayMenuItemId::RestartGateway,
                    item_type: TrayMenuItemType::Normal,
                    label: "Restart Gateway".to_string(),
                    enabled: self.gateway_running,
                    checked: None,
                    children: None,
                    accelerator: None,
                    icon: None,
                },
            ]),
            accelerator: None,
            icon: None,
        });

        // Subscription submenu
        let subscription_label = format!(
            "Subscription: {}",
            if self.subscription_active {
                "Active"
            } else {
                "Inactive"
            }
        );

        items.push(TrayMenuItem {
            id: TrayMenuItemId::SubscriptionStatus,
            item_type: TrayMenuItemType::Submenu,
            label: subscription_label,
            enabled: true,
            checked: None,
            children: Some(vec![TrayMenuItem {
                id: TrayMenuItemId::CheckSubscription,
                item_type: TrayMenuItemType::Normal,
                label: "Check Now".to_string(),
                enabled: self.gateway_running,
                checked: None,
                children: None,
                accelerator: None,
                icon: None,
            }]),
            accelerator: None,
            icon: None,
        });

        // Separator
        items.push(TrayMenuItem {
            id: TrayMenuItemId::Settings, // Placeholder ID
            item_type: TrayMenuItemType::Separator,
            label: String::new(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: None,
            icon: None,
        });

        // Settings
        items.push(TrayMenuItem {
            id: TrayMenuItemId::Settings,
            item_type: TrayMenuItemType::Normal,
            label: "Settings".to_string(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: Some("Ctrl+,".to_string()),
            icon: None,
        });

        // About
        items.push(TrayMenuItem {
            id: TrayMenuItemId::About,
            item_type: TrayMenuItemType::Normal,
            label: "About EdwinPAI".to_string(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: None,
            icon: None,
        });

        // Check for updates
        items.push(TrayMenuItem {
            id: TrayMenuItemId::CheckForUpdates,
            item_type: TrayMenuItemType::Normal,
            label: if self.update_available {
                "Update Available!".to_string()
            } else {
                "Check for Updates".to_string()
            },
            enabled: true,
            checked: None,
            children: None,
            accelerator: None,
            icon: None,
        });

        // Separator
        items.push(TrayMenuItem {
            id: TrayMenuItemId::Quit, // Placeholder ID
            item_type: TrayMenuItemType::Separator,
            label: String::new(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: None,
            icon: None,
        });

        // Quit
        items.push(TrayMenuItem {
            id: TrayMenuItemId::Quit,
            item_type: TrayMenuItemType::Normal,
            label: "Quit EdwinPAI".to_string(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: Some("Ctrl+Q".to_string()),
            icon: None,
        });

        TrayMenu { items }
    }
}

// ============================================================================
// IPC Message Types
// ============================================================================

/// Update tray menu request
#[derive(Debug, Deserialize)]
pub struct UpdateTrayMenuRequest {
    pub state: TrayMenuState,
}

/// Update tray menu response
#[derive(Debug, Serialize)]
pub struct UpdateTrayMenuResponse {
    pub success: bool,
}

/// Get tray menu state request (empty)
#[derive(Debug, Deserialize)]
pub struct GetTrayMenuStateRequest {}

/// Get tray menu state response
#[derive(Debug, Serialize)]
pub struct GetTrayMenuStateResponse {
    pub state: TrayMenuState,
}

/// Set tray tooltip request
#[derive(Debug, Deserialize)]
pub struct SetTrayTooltipRequest {
    pub tooltip: String,
}

/// Set tray tooltip response
#[derive(Debug, Serialize)]
pub struct SetTrayTooltipResponse {
    pub success: bool,
}

/// Set tray icon request
#[derive(Debug, Deserialize)]
pub struct SetTrayIconRequest {
    pub icon: TrayIconType,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayIconType {
    Default,
    Active,
    Warning,
    Error,
}

/// Set tray icon response
#[derive(Debug, Serialize)]
pub struct SetTrayIconResponse {
    pub success: bool,
}

// ============================================================================
// Events
// ============================================================================

/// Menu item clicked event payload
#[derive(Debug, Clone, Serialize)]
pub struct MenuItemClickedEventPayload {
    pub item_id: TrayMenuItemId,
    pub timestamp: String, // ISO 8601
}

impl MenuItemClickedEventPayload {
    pub fn new(item_id: TrayMenuItemId) -> Self {
        Self {
            item_id,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Tray icon clicked event payload
#[derive(Debug, Clone, Serialize)]
pub struct TrayIconClickedEventPayload {
    pub button: MouseButton,
    pub timestamp: String, // ISO 8601
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

impl TrayIconClickedEventPayload {
    pub fn new(button: MouseButton) -> Self {
        Self {
            button,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_menu_state_default() {
        let state = TrayMenuState::default();
        assert_eq!(state.window_visible, true);
        assert_eq!(state.gateway_running, false);
        assert_eq!(state.subscription_active, false);
    }

    #[test]
    fn test_tray_menu_build() {
        let state = TrayMenuState {
            window_visible: true,
            gateway_running: true,
            gateway_healthy: true,
            subscription_active: true,
            update_available: false,
            channel_count: 0,
        };

        let menu = state.build_menu();
        assert!(!menu.items.is_empty());

        // Verify first item is "Hide EdwinPAI" when window visible
        let first_item = &menu.items[0];
        assert_eq!(first_item.id, TrayMenuItemId::HideWindow);
        assert_eq!(first_item.label, "Hide EdwinPAI");
    }

    #[test]
    fn test_menu_item_id_as_str() {
        assert_eq!(TrayMenuItemId::ShowWindow.as_str(), "show_window");
        assert_eq!(TrayMenuItemId::Quit.as_str(), "quit");
    }

    #[test]
    fn test_menu_item_serialization() {
        let item = TrayMenuItem {
            id: TrayMenuItemId::Settings,
            item_type: TrayMenuItemType::Normal,
            label: "Settings".to_string(),
            enabled: true,
            checked: None,
            children: None,
            accelerator: Some("Ctrl+,".to_string()),
            icon: None,
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"settings\""));
        assert!(json.contains("\"enabled\":true"));
    }
}
