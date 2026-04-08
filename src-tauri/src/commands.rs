use crate::app_state::AppState;
use crate::config::AppConfig;
use crate::error::InvokeResponse;
use crate::services::Services;
use tauri::State;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn load_config(state: State<AppState>) -> Result<InvokeResponse, String> {
    let config = Services::load_config(&state)?;
    Ok(InvokeResponse {
        ok: true,
        message: "配置加载成功".to_string(),
        code: None,
        details: serde_json::to_value(&config).unwrap_or(serde_json::Value::Null),
        logs: Vec::new(),
    })
}

#[tauri::command]
pub fn save_config(
    state: State<AppState>,
    config: serde_json::Value,
) -> Result<InvokeResponse, String> {
    let app_config: AppConfig =
        serde_json::from_value(config).map_err(|e| format!("解析配置失败: {}", e))?;
    Services::save_config(&state, &app_config)?;
    Ok(InvokeResponse {
        ok: true,
        message: "配置保存成功".to_string(),
        code: None,
        details: serde_json::Value::Null,
        logs: Vec::new(),
    })
}

#[tauri::command]
pub fn get_app_info(state: State<AppState>) -> Result<serde_json::Value, String> {
    let resources = state.ensure_resources();
    Ok(serde_json::json!({
        "display_name": "MTGA",
        "version": env!("CARGO_PKG_VERSION"),
        "github_repo": "BiFangKNT/mtga-tauri",
        "ca_common_name": "MTGA_CA",
        "api_key_visible_chars": 4,
        "user_data_dir": resources.user_data_dir(),
    }))
}

#[tauri::command]
pub fn generate_certificates(state: State<AppState>) -> InvokeResponse {
    Services::generate_certificates(&state)
}

#[tauri::command]
pub fn install_ca_cert(state: State<AppState>) -> InvokeResponse {
    Services::install_ca_cert(&state)
}

#[tauri::command]
pub fn clear_ca_cert(state: State<AppState>, common_name: Option<String>) -> InvokeResponse {
    Services::clear_ca_cert(
        &state,
        &common_name.unwrap_or_else(|| "MTGA_CA".to_string()),
    )
}

#[tauri::command]
pub fn hosts_modify(
    state: State<AppState>,
    mode: String,
    domain: Option<String>,
    ip: Option<serde_json::Value>,
) -> InvokeResponse {
    Services::hosts_modify(&state, &mode, domain.as_deref(), ip.as_ref())
}

#[tauri::command]
pub fn hosts_open(state: State<AppState>) -> InvokeResponse {
    Services::hosts_open(&state)
}

#[tauri::command]
pub async fn proxy_start(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    debug_mode: bool,
    disable_ssl_strict_mode: bool,
    force_stream: bool,
    stream_mode: Option<String>,
) -> Result<InvokeResponse, String> {
    let config = Services::load_config(&state).unwrap_or_default();
    let runtime_opts = crate::app_state::RuntimeOptions {
        debug_mode,
        disable_ssl_strict: disable_ssl_strict_mode,
        force_stream,
        stream_mode: stream_mode.unwrap_or_else(|| "true".to_string()),
    };
    Ok(Services::proxy_start(
        &state,
        app_handle,
        &config.config_groups,
        &config.global_config,
        &runtime_opts,
    )
    .await)
}

#[tauri::command]
pub async fn proxy_stop(state: State<'_, AppState>) -> Result<InvokeResponse, String> {
    Ok(Services::proxy_stop(&state).await)
}

#[tauri::command]
pub fn proxy_check_network(state: State<AppState>) -> InvokeResponse {
    let log_bus = state.ensure_log_bus();
    let mut collector = crate::config::LogCollector::new(Some(log_bus));

    collector.log("正在检查网络环境...");

    let domains = [
        ("api.openai.com", "OpenAI"),
        ("api.anthropic.com", "Anthropic"),
        ("generativelanguage.googleapis.com", "Gemini"),
    ];

    let rt = tokio::runtime::Runtime::new();
    let rt = match rt {
        Ok(r) => r,
        Err(e) => {
            return collector.into_response(
                crate::error::OperationResult::failure(&format!("创建运行时失败: {}", e)),
                "网络检查失败",
            );
        }
    };

    for (domain, label) in &domains {
        let result = rt.block_on(async {
            reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .ok()?
                .get(format!("https://{}", domain))
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await
                .ok()
        });

        match result {
            Some(resp) => {
                let status = resp.status().as_u16();
                collector.log(&format!("✅ {} ({}): HTTP {}", label, domain, status));
            }
            None => {
                collector.log(&format!("❌ {} ({}): 无法连接", label, domain));
            }
        }
    }

    collector.into_response(crate::error::OperationResult::success(), "网络检查完成")
}

#[tauri::command]
pub async fn proxy_start_all(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    debug_mode: bool,
    disable_ssl_strict_mode: bool,
    force_stream: bool,
    stream_mode: Option<String>,
) -> Result<InvokeResponse, String> {
    let config = Services::load_config(&state).unwrap_or_default();
    let runtime_opts = crate::app_state::RuntimeOptions {
        debug_mode,
        disable_ssl_strict: disable_ssl_strict_mode,
        force_stream,
        stream_mode: stream_mode.unwrap_or_else(|| "true".to_string()),
    };
    Ok(Services::proxy_start_all(
        &state,
        app_handle,
        &config.config_groups,
        &config.global_config,
        &runtime_opts,
    )
    .await)
}

#[tauri::command]
pub fn pull_logs(
    state: State<AppState>,
    after_id: Option<usize>,
    max_items: Option<usize>,
) -> serde_json::Value {
    let log_bus = state.ensure_log_bus();
    let result = log_bus.pull(after_id, max_items.unwrap_or(200));
    serde_json::json!({
        "items": result.logs.iter().map(|e| e.text.clone()).collect::<Vec<_>>(),
        "next_id": result.next_id,
        "has_more": result.has_more,
    })
}

#[tauri::command]
pub fn frontend_report(state: State<AppState>, message: String) {
    let log_bus = state.ensure_log_bus();
    log_bus.push(format!("[前端] {}", message));
}

#[tauri::command]
pub fn startup_status(state: State<AppState>) -> InvokeResponse {
    let resources = state.ensure_resources();
    let log_bus = state.ensure_log_bus();
    let mut collector = crate::config::LogCollector::new(Some(log_bus));

    collector.log(&format!("用户数据目录: {}", resources.user_data_dir()));

    let ca_cert_path = resources.get_ca_cert_path();
    let cert_exists = std::path::Path::new(&ca_cert_path).exists();
    if cert_exists {
        collector.log("✅ CA 证书已存在");
    } else {
        collector.log("⚠️ CA 证书未生成");
    }

    collector.log("MTGA 已启动");
    collector.log("请选择操作或直接使用一键启动...");

    collector.into_response(
        crate::error::OperationResult::success_with_details(serde_json::json!({
            "env_ok": true,
            "env_message": "环境检查通过",
            "runtime": "tauri",
        })),
        "启动状态",
    )
}

#[tauri::command]
pub async fn config_group_test(
    state: State<'_, AppState>,
    index: usize,
) -> Result<InvokeResponse, String> {
    let config = Services::load_config(&state).unwrap_or_default();
    Ok(
        Services::config_group_test(&state, index, &config.config_groups, &config.global_config)
            .await,
    )
}

#[tauri::command]
pub async fn config_group_models(
    state: State<'_, AppState>,
    provider: Option<String>,
    api_url: String,
    api_key: Option<String>,
    middle_route: Option<String>,
) -> Result<InvokeResponse, String> {
    Ok(Services::config_group_models(
        &state,
        provider.as_deref().unwrap_or("openai_chat_completion"),
        &api_url,
        api_key.as_deref().unwrap_or(""),
        middle_route.as_deref().unwrap_or(""),
    )
    .await)
}

#[tauri::command]
pub fn system_prompts_list(state: State<AppState>) -> InvokeResponse {
    Services::system_prompts_list(&state)
}

#[tauri::command]
pub fn system_prompts_update(
    state: State<AppState>,
    hash: String,
    edited_text: String,
) -> InvokeResponse {
    Services::system_prompts_update(&state, &hash, &edited_text)
}

#[tauri::command]
pub fn system_prompts_delete(state: State<AppState>, hashes: Vec<String>) -> InvokeResponse {
    Services::system_prompts_delete(&state, &hashes)
}

#[tauri::command]
pub async fn check_updates(state: State<'_, AppState>) -> Result<InvokeResponse, String> {
    Ok(Services::check_updates(&state).await)
}

#[tauri::command]
pub fn user_data_open_dir(state: State<AppState>) -> InvokeResponse {
    Services::user_data_open_dir(&state)
}

#[tauri::command]
pub fn user_data_backup(state: State<AppState>) -> InvokeResponse {
    Services::user_data_backup(&state)
}

#[tauri::command]
pub fn user_data_restore_latest(state: State<AppState>) -> InvokeResponse {
    Services::user_data_restore_latest(&state)
}

#[tauri::command]
pub fn user_data_clear(state: State<AppState>) -> InvokeResponse {
    Services::user_data_clear(&state)
}
