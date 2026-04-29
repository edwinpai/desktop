// System tray module tests

use crate::tray::{TrayManager, TrayState};

#[test]
fn test_tray_manager_initialization() {
    let manager = TrayManager::new();

    assert_eq!(manager.get_state(), TrayState::Idle);
}

#[test]
fn test_tray_manager_default() {
    let manager = TrayManager::default();

    assert_eq!(manager.get_state(), TrayState::Idle);
}

#[test]
fn test_tray_state_equality() {
    assert_eq!(TrayState::Idle, TrayState::Idle);
    assert_eq!(TrayState::Running, TrayState::Running);
    assert_eq!(TrayState::Error, TrayState::Error);

    assert_ne!(TrayState::Idle, TrayState::Running);
    assert_ne!(TrayState::Running, TrayState::Error);
}

#[test]
fn test_tray_state_copy() {
    let state1 = TrayState::Running;
    let state2 = state1; // Copy, not move

    assert_eq!(state1, TrayState::Running);
    assert_eq!(state2, TrayState::Running);
}

#[test]
fn test_tray_state_debug() {
    let state = TrayState::Running;
    let debug_str = format!("{:?}", state);

    assert!(debug_str.contains("Running"));
}

// Note: Full tray functionality requires AppHandle and Tauri runtime
// These tests verify the basic state management without UI integration

#[test]
fn test_tray_manager_state_persistence() {
    let manager = TrayManager::new();

    // Initial state
    assert_eq!(manager.get_state(), TrayState::Idle);

    // Note: update_state() requires AppHandle, so we can only test
    // the get_state() functionality in unit tests
}
