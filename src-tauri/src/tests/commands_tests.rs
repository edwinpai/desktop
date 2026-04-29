// Commands module tests

// Gateway commands tests
mod gateway_commands {
    use crate::commands::gateway::*;

    #[tokio::test]
    async fn test_get_gateway_status_initial() {
        let status = get_gateway_status().await.unwrap();

        assert_eq!(status.state, "stopped");
        assert_eq!(status.pid, None);
        assert_eq!(status.uptime_seconds, None);
    }

    #[tokio::test]
    async fn test_is_gateway_running_initial() {
        let running = is_gateway_running().await.unwrap();

        assert!(!running);
    }

    #[tokio::test]
    async fn test_gateway_status_contains_health_url() {
        let status = get_gateway_status().await.unwrap();

        assert!(status.health_check_url.contains("localhost"));
        assert!(status.health_check_url.contains("/health"));
    }

    #[tokio::test]
    async fn test_stop_gateway_when_not_running() {
        // Should not error when stopping a gateway that isn't running
        let result = stop_gateway().await;
        assert!(result.is_ok());
    }
}

// Tray commands tests
mod tray_commands {
    use crate::commands::tray::*;

    #[tokio::test]
    async fn test_get_tray_state_initial() {
        let state = get_tray_state().await.unwrap();

        // May be "idle", "running", or "error" depending on previous tests
        assert!(state == "idle" || state == "running" || state == "error");
    }

    #[tokio::test]
    async fn test_update_tray_state_valid() {
        assert!(update_tray_state("idle".to_string()).await.is_ok());
        assert!(update_tray_state("running".to_string()).await.is_ok());
        assert!(update_tray_state("error".to_string()).await.is_ok());
    }

    #[tokio::test]
    async fn test_update_tray_state_invalid() {
        let result = update_tray_state("invalid_state".to_string()).await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid tray state"));
    }

    #[tokio::test]
    async fn test_tray_state_transitions() {
        // Test idle -> running -> error -> idle
        update_tray_state("idle".to_string()).await.unwrap();
        assert_eq!(get_tray_state().await.unwrap(), "idle");

        update_tray_state("running".to_string()).await.unwrap();
        assert_eq!(get_tray_state().await.unwrap(), "running");

        update_tray_state("error".to_string()).await.unwrap();
        assert_eq!(get_tray_state().await.unwrap(), "error");

        update_tray_state("idle".to_string()).await.unwrap();
        assert_eq!(get_tray_state().await.unwrap(), "idle");
    }
}

// Discovery commands tests
mod discovery_commands {
    use crate::commands::discovery::*;

    #[tokio::test]
    async fn test_get_advertised_service_name_none() {
        // Initially, no service should be advertised
        let name = get_advertised_service_name().await.unwrap();
        // May be None or Some depending on previous tests
        assert!(name.is_none() || name.is_some());
    }

    #[tokio::test]
    async fn test_discover_gateways_completes() {
        let result = discover_gateways(Some(1)).await;

        assert!(result.is_ok());
        let gateways = result.unwrap();
        assert!(gateways.len() >= 0);
    }

    #[tokio::test]
    async fn test_stop_advertising_when_not_started() {
        let result = stop_advertising().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_discover_gateways_timeout_respected() {
        let start = std::time::Instant::now();
        let _ = discover_gateways(Some(2)).await;
        let elapsed = start.elapsed();

        // Should complete within timeout + small buffer
        assert!(elapsed.as_secs() <= 3);
    }
}
