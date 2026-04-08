mod app_state;
mod cert;
mod commands;
mod config;
mod error;
mod hosts;
mod log_bus;
mod proxy;
mod resource_manager;
mod services;
mod system_prompt;
mod update;
mod user_data;

use app_state::AppState;
use log_bus::LogBus;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::MenuEvent;
use tauri::tray::TrayIconBuilder;

pub fn run() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            let log_bus = LogBus::new();
            app.manage(log_bus.clone());

            let show_item = tauri::menu::MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit_item = tauri::menu::MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let handle_for_menu = app.handle().clone();
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("MTGA - 一键启动全部服务")
                .menu(&menu)
                .on_menu_event(move |_tray, event: MenuEvent| match event.id.as_ref() {
                    "show" => {
                        if let Some(main_win) = handle_for_menu.get_webview_window("main") {
                            let _ = main_win.show();
                            let _ = main_win.set_focus();
                        }
                    }
                    "quit" => {
                        handle_for_menu.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = handle.clone();
                        if let Some(main_win) = app_handle.get_webview_window("main") {
                            if main_win.is_visible().unwrap_or(false) {
                                let _ = main_win.hide();
                            } else {
                                let _ = main_win.show();
                                let _ = main_win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            let splash_win: Option<tauri::WebviewWindow> = app.get_webview_window("splash");
            let main_win: Option<tauri::WebviewWindow> = app.get_webview_window("main");
            let handle_for_event = app.handle().clone();

            std::thread::spawn(move || {
                if let Some(ref splash) = splash_win {
                    let _ = splash.eval(
                        r#"
                        window.addEventListener('DOMContentLoaded', () => {
                            setTimeout(() => {
                                window.__TAURI__.event.emit('mtga:overlay-ready');
                            }, 800);
                        });
                    "#,
                    );
                }
                std::thread::sleep(std::time::Duration::from_millis(1500));

                let _ = handle_for_event.emit("mtga:backend-ready", ());

                if let (Some(splash), Some(main)) = (&splash_win, &main_win) {
                    let _ = main.show();
                    let _ = main.set_focus();
                    let _ = splash.close();
                }
            });

            let main_win: tauri::WebviewWindow = app
                .get_webview_window("main")
                .expect("main window not found");
            main_win.clone().on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = main_win.hide();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::load_config,
            commands::save_config,
            commands::get_app_info,
            commands::generate_certificates,
            commands::install_ca_cert,
            commands::clear_ca_cert,
            commands::hosts_modify,
            commands::hosts_open,
            commands::proxy_start,
            commands::proxy_stop,
            commands::proxy_check_network,
            commands::proxy_start_all,
            commands::pull_logs,
            commands::frontend_report,
            commands::startup_status,
            commands::config_group_test,
            commands::config_group_models,
            commands::system_prompts_list,
            commands::system_prompts_update,
            commands::system_prompts_delete,
            commands::check_updates,
            commands::user_data_open_dir,
            commands::user_data_backup,
            commands::user_data_restore_latest,
            commands::user_data_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
