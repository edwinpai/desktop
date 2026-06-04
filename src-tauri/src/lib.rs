pub mod auth;
pub mod channel_domain;
pub mod client;
pub mod client_domain;
mod commands;
pub mod crypto_domain;
pub mod discovery;
pub mod edwinpai_config;
pub mod gateway;
pub mod invitation;
pub mod mdns;
pub mod overlay_domain;
pub mod phase6_types;
pub mod spv_domain;
pub mod subscription;
pub mod tray;

use commands::tray::TrayManagerState;
#[cfg(target_os = "linux")]
use tauri::image::Image;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;
use tauri::Manager;

#[cfg(test)]
mod tests;

#[cfg(test)]
pub mod test_types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(TrayManagerState(std::sync::Mutex::new(
            tray::TrayMenuManager::new(),
        )))
        .invoke_handler(tauri::generate_handler![
            commands::crypto::get_identity,
            commands::crypto::derive_key,
            commands::crypto::sign_message,
            commands::crypto::verify_message,
            commands::crypto::generate_identicon,
            commands::spv::spv_verify,
            commands::spv::check_subscription,
            commands::spv::submit_to_arcade,
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::restart_gateway,
            commands::gateway::get_gateway_status,
            commands::gateway::gateway_health_check,
            commands::gateway::is_gateway_running,
            commands::gateway_real::start_gateway_real,
            commands::gateway_real::stop_gateway_real,
            commands::gateway_real::get_gateway_status_real,
            commands::gateway_real::get_gateway_logs,
            commands::gateway_real::probe_gateway,
            commands::gateway_real::scan_gateways,
            commands::chat::chat_proxy,
            commands::tray::update_tray_state,
            commands::tray::update_tray_show_hide,
            commands::tray::get_tray_state,
            commands::tray::setup_tray,
            commands::tray::set_tray_tooltip,
            commands::vault::vault_store,
            commands::vault::vault_reveal,
            commands::vault::vault_use_for_credential_request,
            commands::vault::vault_list,
            commands::vault::vault_delete,
            commands::discovery::advertise_gateway,
            commands::discovery::stop_advertising,
            commands::discovery::discover_gateways,
            commands::discovery::get_advertised_service_name,
            commands::config::get_config,
            commands::config::save_config,
            commands::config::get_config_path,
            commands::config::reset_config,
            commands::config::set_mode,
            commands::client::scan_network,
            commands::client::connect_to_gateway,
            commands::client::disconnect,
            commands::client::get_connection_status,
            commands::client::get_authorized_users,
            commands::client::authorize_user,
            commands::invitation::create_invitation_qr,
            commands::invitation::scan_qr_code,
            commands::invitation::accept_invitation,
            commands::auth::list_users,
            commands::auth::get_user,
            commands::auth::remove_user,
            commands::auth::update_user_activity,
            commands::auth::create_invitation,
            commands::auth::get_invitation_qr,
            commands::auth::redeem_invitation,
            commands::auth::revoke_invitation,
            commands::auth::list_invitations,
            commands::auth::check_authorization,
            commands::auth::verify_brc103_signature,
            commands::channels::create_channel_cmd,
            commands::channels::read_channel_cmd,
            commands::channels::read_channel_decrypted_cmd,
            commands::channels::update_channel_cmd,
            commands::channels::delete_channel_cmd,
            commands::channels::list_channels_cmd,
            commands::channels::validate_channel_credentials_cmd,
            commands::channels::toggle_channel_cmd,
            commands::channels::request_whatsapp_qr_cmd,
            commands::channels::check_whatsapp_status_cmd,
            commands::config_real::get_edwinpai_config,
            commands::config_real::update_edwinpai_config_cmd,
            commands::config_real::update_edwinpai_config,
            commands::config_real::validate_edwinpai_config,
            commands::signed_request::sign_request,
            commands::signed_request::sign_challenge,
            commands::signed_request::get_auth_identity,
            commands::app_lock::has_app_lock,
            commands::app_lock::set_app_lock,
            commands::app_lock::verify_app_lock,
            commands::app_lock::disable_app_lock,
            commands::app_lock::get_lock_status,
            commands::keychain_real::generate_identity,
            commands::keychain_real::has_identity,
            commands::keychain_real::get_public_key,
            commands::keychain_real::delete_identity,
            commands::providers::list_providers,
            commands::providers::login_openai_codex_oauth_to_vault,
            commands::providers::import_openai_codex_oauth_profile_to_vault,
            commands::providers::add_provider,
            commands::providers::remove_provider,
            commands::runtime::check_runtime,
            commands::ssh_tunnel::cleanup_ssh_tunnel_port,
            commands::knowledge::knowledge_list_sources,
            commands::knowledge::knowledge_list_disciplines,
            commands::knowledge::knowledge_get_discipline_details,
            commands::knowledge::knowledge_create_discipline,
            commands::knowledge::knowledge_update_discipline,
            commands::knowledge::knowledge_delete_discipline,
            commands::knowledge::knowledge_build_discipline,
            commands::knowledge::knowledge_list_runs,
            commands::knowledge::knowledge_get_run_details,
            commands::workflows::workflow_list,
            commands::workflows::workflow_status,
            commands::workflows::workflow_history,
            commands::workflows::workflow_run,
            commands::workflows::workflow_pending,
            commands::workflows::workflow_approve,
            commands::workflows::workflow_deny,
            commands::workflows::workflow_logs,
            commands::workflows::workflow_list_files,
            commands::workflows::workflow_load_file,
            commands::workflows::workflow_save_file,
            commands::workflows::workflow_create_file,
        ])
        .setup(|app| {
            // Initialize auth domain (user/invitation management)
            if let Err(e) = commands::auth::init_auth_domain() {
                eprintln!("Failed to initialize auth domain: {}", e);
            }

            // Initialize config manager
            if let Err(e) = commands::config::init_config_manager() {
                eprintln!("Failed to initialize config manager: {}", e);
            }

            // Initialize system tray using managed state
            let app_handle = app.handle().clone();

            {
                let tray_state: tauri::State<'_, TrayManagerState> = app.state();
                let manager = tray_state.0.lock().unwrap();
                if let Err(e) = manager.setup(&app_handle) {
                    eprintln!("Failed to setup system tray: {}", e);
                }
            }

            // Setup window close handler for minimize-to-tray behavior
            if let Some(window) = app.get_webview_window("main") {
                tray::setup_window_close_handler(&window);
                #[cfg(target_os = "linux")]
                {
                    if let Ok(icon) = Image::from_bytes(include_bytes!("../icons/128x128.png")) {
                        let _ = window.set_icon(icon);
                    }
                }
                #[cfg(target_os = "macos")]
                {
                    let _ = app
                        .handle()
                        .set_activation_policy(ActivationPolicy::Regular);
                }
                // Do not force show/focus here: Tauri already manages the initial main
                // window presentation, and re-showing/re-focusing during startup can
                // cause visible flicker or bounce on macOS.
            }

            // Probe gateway in background and update tray state
            let probe_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // Small delay to let things initialize
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;

                let urls = ["http://localhost:18789", "http://127.0.0.1:18789"];

                let mut gateway_found = false;
                for url in &urls {
                    if let Ok(resp) = reqwest::get(*url).await {
                        if resp.status().is_success()
                            || resp.status().as_u16() == 404
                            || resp.status().as_u16() == 426
                        {
                            // Any response means the gateway is running
                            gateway_found = true;
                            break;
                        }
                    }
                }

                if gateway_found {
                    let new_state = tray::types::TrayMenuState {
                        window_visible: true,
                        gateway_running: true,
                        gateway_healthy: true,
                        subscription_active: false,
                        update_available: false,
                        channel_count: 0,
                    };
                    let tray_state = probe_handle.state::<TrayManagerState>();
                    let manager = tray_state.0.lock().unwrap();
                    if let Err(e) = manager.update_state(&probe_handle, new_state) {
                        eprintln!("Failed to update tray state: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
